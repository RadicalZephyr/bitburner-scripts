import type { NS, AutocompleteData } from "netscript";

import {
    growAnalyze,
    minimumTimeDelta,
    numThreads,
    setInstanceStartTimes,
    singleTargetBatchOptions,
    spawnBatchScript,
    weakenAmount as weakenAmountFn,
    weakenThreads as weakenThreadsFn
} from '../lib.js';

export function autocomplete(data: AutocompleteData, _args: string[]): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    const [host, target] = singleTargetBatchOptions(ns);

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

    if (totalThreads < 1) {
        ns.tprint(`${target} does not need to be built`);
    } else if (maxHostThreads > totalThreads && totalThreads > 0) {
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

        const totalEfficientBatchThreads = growThreads + weakenThreads;
        const numberOfParallelBatches = Math.floor(maxHostThreads / totalEfficientBatchThreads);

        let totalNeededGrowThreads = growInstance.threads;

        growInstance.threads = growThreads * numberOfParallelBatches;
        weakenInstance.threads = weakenThreads * numberOfParallelBatches;

        ns.tprint('actual threads to spawn');
        ns.tprintf('g %s w %s', ...scriptInstances.map(i => i.threads));

        const waitTime = weakenInstance.startTime + weakenInstance.runTime + minimumTimeDelta;

        for (let spawnedGrowThreads = 0; spawnedGrowThreads < totalNeededGrowThreads; spawnedGrowThreads += growInstance.threads) {
            scriptInstances.forEach(inst => spawnBatchScript(ns, inst));
            await ns.sleep(waitTime);

        }
        // const sleepTimeBetweenBatches = scriptInstances.length * minimumTimeDelta;
        // for (let index = 0; index < numberOfParallelBatches; ++index) {
        //     scriptInstances.forEach(inst => spawnBatchScript(ns, inst, index));
        //     await ns.sleep(sleepTimeBetweenBatches);
        // }
    }
}
