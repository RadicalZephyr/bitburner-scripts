import type { NS, AutocompleteData } from "netscript";

import {
    BatchScriptInstance,
    growAnalyze,
    minimumTimeDelta,
    numThreads,
    setInstanceStartTimes,
    singleTargetBatchOptions,
    spawnBatchScript,
    weakenAmount as weakenAmountFn,
    weakenAnalyze,
    weakenThreads as weakenThreadsFn
} from '../lib.js';

export function autocomplete(data: AutocompleteData, _args: string[]): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    const [host, target] = singleTargetBatchOptions(ns);

    let maxHostThreads = numThreads(ns, host, '/batch/grow.js');

    const scriptInstances = calculateBuildBatch(ns, target);
    const [growInstance, weakenInstance] = scriptInstances;

    const totalThreads = scriptInstances.reduce((sum, i) => sum + i.threads, 0);

    const scriptDescriptions = scriptInstances.map(si => `  ${si.script} -t ${si.threads}`).join('\n');
    ns.tprint(`
building ${target} from ${host}:
${scriptDescriptions}
`);

    if (totalThreads < 1) {
        ns.tprint(`${target} does not need to be built`);
    } else if (maxHostThreads > totalThreads && totalThreads > 0) {
        scriptInstances.forEach(i => spawnBatchScript(ns, host, i));
    } else {
        ns.tprint(`
not enough threads
total threads available on ${host}: ${maxHostThreads}
`);
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
        growSecurityIncrease = ns.growthAnalyzeSecurity(growThreads, target, 1);
        const postWeakenThreads = weakenThreadsFn(growSecurityIncrease);
        ns.tprintf('g %s w-pre %s w-post %s', growThreads, weakenThreads, postWeakenThreads);

        const totalEfficientBatchThreads = growThreads + weakenThreads;
        const numberOfParallelBatches = Math.floor(maxHostThreads / totalEfficientBatchThreads);

        let totalNeededGrowThreads = growInstance.threads;

        growInstance.threads = growThreads * numberOfParallelBatches;
        growSecurityIncrease = ns.growthAnalyzeSecurity(growInstance.threads, target, 1);
        weakenInstance.threads = weakenThreadsFn(growSecurityIncrease);

        ns.tprint('actual threads to spawn');
        ns.tprintf('g %s w %s', ...scriptInstances.map(i => i.threads));

        const waitTime = weakenInstance.startTime + weakenInstance.runTime + minimumTimeDelta;

        for (let spawnedGrowThreads = 0; spawnedGrowThreads < totalNeededGrowThreads; spawnedGrowThreads += growInstance.threads) {
            scriptInstances.forEach(inst => spawnBatchScript(ns, host, inst));
            await ns.sleep(waitTime);
        }
    }
}

function calculateBuildBatch(ns: NS, target: string): BatchScriptInstance[] {
    const maxMoney = ns.getServerMaxMoney(target);
    const currentMoney = ns.getServerMoneyAvailable(target);

    const neededGrowRatio = currentMoney > 0 ? maxMoney / currentMoney : maxMoney;

    let growInstance = {
        target,
        script: '/batch/grow.js',
        threads: growAnalyze(ns, target, neededGrowRatio),
        startTime: 0,
        runTime: ns.getGrowTime(target),
        endDelay: 0,
        loop: false
    };

    const growSecurityIncrease = ns.growthAnalyzeSecurity(growInstance.threads, target, 1);

    const weakenInstance = {
        target,
        script: '/batch/weaken.js',
        threads: weakenAnalyze(ns, target, 1.0) + weakenThreadsFn(growSecurityIncrease),
        startTime: 0,
        runTime: ns.getWeakenTime(target),
        endDelay: 0,
        loop: false
    };

    const scriptInstances = [growInstance, weakenInstance];

    setInstanceStartTimes(scriptInstances);

    return scriptInstances;
}
