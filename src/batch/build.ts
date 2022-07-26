import type { NS, AutocompleteData } from "netscript";

import {
    BatchScriptInstance,
    byAvailableRam,
    growAnalyze,
    numThreads,
    setInstanceStartTimes,
    spawnBatchScript,
    usableHosts,
    weakenAmount as weakenAmountFn,
    weakenThreads as weakenThreadsFn
} from '../lib.js';
import { walkNetworkBFS } from "../walk-network.js";

export function autocomplete(data: AutocompleteData, _args: string[]): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    const target = ns.args[0];
    if (typeof target != 'string' || !ns.serverExists(target)) {
        ns.tprintf('invalid target');
        return;
    }

    const buildRound = calculateBuildRound(ns, target);

    const scriptDescriptions = buildRound.instances.map(si => `  ${si.script} -t ${si.threads}`).join('\n');
    ns.tprint(`
building ${target}:
${scriptDescriptions}
`);

    if (buildRound.totalThreads < 1) {
        ns.tprint(`${target} does not need to be built`);
        return;
    }

    const network = walkNetworkBFS(ns);
    const allHosts = Array.from(network.keys());

    let hosts = usableHosts(ns, allHosts);
    hosts.sort(byAvailableRam(ns));

    let batchNumber = 0;

    for (const host of hosts) {
        let availableHostThreads = numThreads(ns, host, '/batch/grow.js');

        while (batchNumber < buildRound.numberOfBatches && availableHostThreads > buildRound.totalBatchThreads) {
            buildRound.instances.forEach(inst => spawnBatchScript(ns, host, inst, batchNumber));
            batchNumber += 1;
            await ns.sleep(10);
            availableHostThreads = numThreads(ns, host, '/batch/grow.js');
        }
    }
}

type BatchRound = {
    target: string;
    instances: BatchScriptInstance[];
    numberOfBatches: number;
    totalBatchThreads: number;
    totalThreads: number;
};

function calculateBuildRound(ns: NS, target: string): BatchRound {
    const maxMoney = ns.getServerMaxMoney(target);
    const currentMoney = ns.getServerMoneyAvailable(target);

    const neededGrowRatio = currentMoney > 0 ? maxMoney / currentMoney : maxMoney;
    const totalGrowThreads = growAnalyze(ns, target, neededGrowRatio);

    const instances = calculateBuildBatch(ns, target);
    const growInstance = instances[0];

    const numberOfBatches = Math.ceil(totalGrowThreads / growInstance.threads);

    const totalBatchThreads = instances.reduce((sum, i) => sum + i.threads, 0);

    const totalThreads = totalBatchThreads * numberOfBatches;

    return {
        target,
        instances,
        numberOfBatches,
        totalBatchThreads,
        totalThreads
    };
}

function calculateBuildBatch(ns: NS, target: string): BatchScriptInstance[] {
    // Calculate minimum size efficient batch, 1 weaken thread and
    // however many grow threads it takes to generate that amount
    // of security increase.
    let growThreads = 2;
    const weakenThreads = 1;
    const weakenAmount = weakenAmountFn(weakenThreads);

    let growSecurityIncrease = ns.growthAnalyzeSecurity(growThreads, target, 1);

    while (growSecurityIncrease < weakenAmount) {
        growThreads += 1;
        growSecurityIncrease = ns.growthAnalyzeSecurity(growThreads, target, 1);
    }
    growThreads = Math.max(1, growThreads - 1);

    let growInstance = {
        target,
        script: '/batch/grow.js',
        threads: growThreads,
        startTime: 0,
        runTime: ns.getGrowTime(target),
        endDelay: 0,
        loop: false
    };

    growSecurityIncrease = ns.growthAnalyzeSecurity(growInstance.threads, target, 1);

    const weakenInstance = {
        target,
        script: '/batch/weaken.js',
        threads: weakenThreadsFn(growSecurityIncrease),
        startTime: 0,
        runTime: ns.getWeakenTime(target),
        endDelay: 0,
        loop: false
    };

    const scriptInstances = [growInstance, weakenInstance];

    setInstanceStartTimes(scriptInstances);

    return scriptInstances;
}
