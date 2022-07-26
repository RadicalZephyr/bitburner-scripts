import type { NS, AutocompleteData } from "netscript";

import {
    BatchScriptInstance,
    growAnalyze,
    hackToGrowPercent,
    numThreads,
    setInstanceStartTimes,
    singleTargetBatchOptions,
    spawnBatchScript,
    timeAlignment,
    weakenThreads
} from '../lib.js';

export function autocomplete(data: AutocompleteData, _args: string[]): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    const [host, target] = singleTargetBatchOptions(ns);

    const maxHostThreads = numThreads(ns, host, '/batch/grow.js');

    const milkRound = calculateMilkRound(ns, host, target);

    const scriptDescriptions = milkRound.instances.map(si => `  ${si.script} -t ${si.threads}`).join('\n');
    ns.tprint(`
milking ${target} from ${host}:
${scriptDescriptions}
total batch time: ${milkRound.totalBatchTime}
number of batches: ${milkRound.numberOfBatches}
total number of threads needed: ${milkRound.totalThreads}
`);

    if (maxHostThreads > milkRound.totalThreads && milkRound.totalThreads > 0) {
        // Start at 1 so we make 1 less batch
        for (let i = 1; i < milkRound.numberOfBatches; ++i) {
            milkRound.instances.forEach(inst => spawnBatchScript(ns, inst, i));
            await ns.sleep(timeAlignment);
        }
        await ns.sleep(timeAlignment);
    } else {
        ns.tprint(`
not enough threads to run milk on ${host}!
`);
    }
}

export type MilkRound = {
    instances: BatchScriptInstance[];
    totalBatchTime: number;
    numberOfBatches: number;
    totalBatchThreads: number;
    totalThreads: number;
    batchOffset: number;
};

export function calculateMilkRound(ns: NS, host: string, target: string): MilkRound {
    const instances = calculateMilkBatch(ns, host, target);

    const lastScriptInstance = instances[instances.length - 1];
    const totalBatchTime = lastScriptInstance.startTime + lastScriptInstance.runTime;
    const numberOfBatches = totalBatchTime / timeAlignment;

    const totalBatchThreads = instances.reduce((sum, i) => sum + i.threads, 0);

    const totalThreads = totalBatchThreads * numberOfBatches;

    return {
        instances,
        totalBatchTime,
        numberOfBatches,
        totalBatchThreads,
        totalThreads,
        batchOffset: timeAlignment
    };
}

function calculateMilkBatch(ns: NS, host: string, target: string): BatchScriptInstance[] {
    // To minimize per-batch thread use but maximize the value
    // rcalculateMilkBatchch, we want to choose the amount we hack
    // per bacalculateMilkBatchlarger of these two amounts:
    //  - proportion hacked by one thread
    //  - proportion grown by one thread
    //
    // Whichever is the smaller amount is then set to 1 thread, and
    // the other is calculated to achieve the same amount of growth.
    //
    // Weaken threads are then calculated based on these amounts
    // because we always need to reduce security to zero.

    // Amount of money hacked per thread
    const oneHackThreadHackPercent = ns.hackAnalyze(target);

    // Start with one thread
    let hackThreads = 1;
    let hackThreadGrowThreads;
    do {
        hackThreads += 1;
        const hackThreadsGrowPercent = hackToGrowPercent(oneHackThreadHackPercent * hackThreads);
        hackThreadGrowThreads = ns.growthAnalyze(target, hackThreadsGrowPercent);
    } while (hackThreadGrowThreads < 1);

    // Reduce number of hack threads by 1. Because we start at 1 and
    // immediately increment it this is at least 1.
    hackThreads -= 1;

    let hackInstance = {
        host,
        target,
        script: '/batch/hack.js',
        threads: hackThreads,
        startTime: 0,
        runTime: ns.getHackTime(target),
        endDelay: 0,
        loop: true
    };

    const hackSecurityIncrease = ns.hackAnalyzeSecurity(hackInstance.threads, target);

    const postHackWeakenThreads = weakenThreads(hackSecurityIncrease);
    let hackWeakenInstance = {
        host,
        target,
        script: '/batch/weaken.js',
        threads: postHackWeakenThreads,
        startTime: 0,
        runTime: ns.getWeakenTime(target),
        endDelay: 0,
        loop: true
    };

    const hackShrinkage = ns.hackAnalyze(target) * hackInstance.threads;
    const neededGrowthRatio = hackToGrowPercent(hackShrinkage);
    ns.print(`hack shrinkage: ${hackShrinkage}`);
    ns.print(`needed recovery growth: ${neededGrowthRatio}`);

    const growThreads = growAnalyze(ns, target, neededGrowthRatio + 0.1);
    let growInstance = {
        host,
        target,
        script: '/batch/grow.js',
        threads: growThreads,
        startTime: 0,
        runTime: ns.getGrowTime(target),
        endDelay: 0,
        loop: true
    };

    // N.B. In order to speculatively calculate how much security will
    // increase, we must _not_ specify the target server. Doing so
    // will cap the projected security growth by the amount of grow
    // threads needed to grow the specified server to max money, and
    // currently we know that server is at max money already, thus
    // security growth will be reported as zero.
    const growSecurityIncrease = ns.growthAnalyzeSecurity(growInstance.threads);

    const postGrowWeakenThreads = weakenThreads(growSecurityIncrease);
    let growWeakenInstance = {
        host,
        target,
        script: '/batch/weaken.js',
        threads: postGrowWeakenThreads,
        startTime: 0,
        runTime: ns.getWeakenTime(target),
        endDelay: 0,
        loop: true
    };

    const scriptInstances = [hackInstance, hackWeakenInstance, growInstance, growWeakenInstance];

    setInstanceStartTimes(scriptInstances);

    return scriptInstances;
}
