import type { NS, AutocompleteData } from "netscript";

import {
    endTime,
    growAnalyze,
    numThreads,
    singleTargetBatchOptions,
    spawnBatchScript,
    weakenThreads
} from '../lib.js';

const minimumTimeDelta = 50;

export function autocomplete(data: AutocompleteData, _args: string[]): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    const [host, target] = singleTargetBatchOptions(ns);

    ns.kill('monitor.js', target);
    ns.run('monitor.js', 1, target);

    let maxHostThreads = numThreads(ns, host, '/batch/grow.js');

    // TODO: In terms of 100% server money, we need to calculate how much to
    // hack, preferably a small enough amount that we can easily grow back to
    // that amount with a reasonable number of threads.
    const hackTime = ns.getHackTime(target);
    const hackThreads = 100; // for now, we go with a single hack thread

    let hackInstance = {
        host,
        target,
        script: '/batch/hack.js',
        threads: hackThreads,
        startTime: 0,
        runTime: hackTime
    };

    const weakenTime = ns.getWeakenTime(target);
    const hackSecurityIncrease = ns.hackAnalyzeSecurity(hackThreads, target);
    const postHackWeakenThreads = weakenThreads(hackSecurityIncrease);

    let hackWeakenInstance = {
        host,
        target,
        script: '/batch/weaken.js',
        threads: postHackWeakenThreads,
        startTime: 0,
        runTime: weakenTime
    };

    const hackShrinkage = ns.hackAnalyze(target) * hackThreads;
    const neededGrowthRatio = 1 / (1 - hackShrinkage);
    ns.print(`hack shrinkage: ${hackShrinkage}`);
    ns.print(`needed recovery growth: ${neededGrowthRatio}`);

    const growTime = ns.getGrowTime(target);
    const growThreads = growAnalyze(ns, target, neededGrowthRatio);

    let growInstance = {
        host,
        target,
        script: '/batch/grow.js',
        threads: growThreads,
        startTime: 0,
        runTime: growTime
    };

    // N.B. In order to speculatively calculate how much security will
    // increase, we must _not_ specify the target server. Doing so
    // will cap the projected security growth by the amount of grow
    // threads needed to grow the specified server to max money, and
    // currently we know that server is at max money alread, thus
    // security growth will be reported as zero.
    const growSecurityIncrease = ns.growthAnalyzeSecurity(growThreads);

    const postGrowWeakenThreads = weakenThreads(growSecurityIncrease);

    let growWeakenInstance = {
        host,
        target,
        script: '/batch/weaken.js',
        threads: postGrowWeakenThreads,
        startTime: 0,
        runTime: weakenTime
    };

    const scriptInstances = [hackInstance, hackWeakenInstance, growInstance, growWeakenInstance];

    ns.print(`grow threads: ${growThreads}\n`);
    ns.print(`grow security increase: ${growSecurityIncrease}\n`);
    ns.print(`post grow weaken threads: ${postGrowWeakenThreads}`);

    const totalThreads = scriptInstances.reduce((sum, i) => sum + i.threads, 0);

    if (maxHostThreads > totalThreads && totalThreads > 0) {
        ns.tprint(`
milking ${target} from ${host}:
  ${hackThreads} hack threads
  ${postHackWeakenThreads} post-hack weaken threads
  ${growThreads} grow threads
  ${postGrowWeakenThreads} post-grow weaken threads
`);

        scriptInstances.reduce((endTime, i) => {
            i.startTime = endTime - i.runTime;
            return endTime + minimumTimeDelta;
        }, 0);

        // Push forward all start times so earliest one is zero
        const earliestStartTime = -Math.min(...scriptInstances.map(i => i.startTime));

        scriptInstances.forEach(i => i.startTime += earliestStartTime);

        scriptInstances.forEach(i => spawnBatchScript(ns, i));
    } else {
        ns.tprint(`
not enough threads to run milk on ${host}
trying to run:
  ${hackThreads} hack threads
  ${postHackWeakenThreads} post-hack weaken threads
  ${growThreads} grow threads
  ${postGrowWeakenThreads} post-grow weaken threads
`);
    }
}
