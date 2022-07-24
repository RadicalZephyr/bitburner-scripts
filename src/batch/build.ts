import type { NS, AutocompleteData } from "netscript";

import {
    growAnalyze,
    numThreads,
    setInstanceStartTimes,
    singleTargetBatchOptions,
    spawnBatchScript,
    weakenAmount as weakenAmountFn,
    weakenThreads as weakenThreadsFn
} from '../lib.js';

const minimumTimeDelta = 50;

export function autocomplete(data: AutocompleteData, args: string[]): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    const [host, target] = singleTargetBatchOptions(ns);

    ns.kill('monitor.js', target);
    ns.run('monitor.js', 1, target);

    let maxHostThreads = numThreads(ns, host, '/batch/grow.js');

    const maxMoney = ns.getServerMaxMoney(target);
    const currentMoney = ns.getServerMoneyAvailable(target);

    const neededGrowRatio = currentMoney > 0 ? maxMoney / currentMoney : maxMoney;

    let growInstance = {
        host,
        target,
        script: '/batch/grow.js',
        threads: growAnalyze(ns, target, neededGrowRatio),
        startTime: 0,
        runTime: ns.getGrowTime(target)
    };

    const growSecurityIncrease = ns.growthAnalyzeSecurity(growInstance.threads, target, 1);

    const weakenInstance = {
        host,
        target,
        script: '/batch/weaken.js',
        threads: weakenThreadsFn(growSecurityIncrease),
        startTime: 0,
        runTime: ns.getWeakenTime(target)
    };

    const scriptInstances = [growInstance, weakenInstance];

    setInstanceStartTimes(scriptInstances);

    const totalThreads = scriptInstances.reduce((sum, i) => sum + i.threads, 0);

    if (maxHostThreads > totalThreads && totalThreads > 0) {
        ns.tprint(`building ${target} with ${growInstance.threads} grow threads and ${weakenInstance.threads} weaken threads on ${host}`);

        scriptInstances.forEach(i => spawnBatchScript(ns, i));
    } else {
        ns.tprint(`
not enough threads
trying to build ${target} with ${growInstance.threads} grow threads and ${weakenInstance.threads} weaken threads on ${host}
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
    }
}
