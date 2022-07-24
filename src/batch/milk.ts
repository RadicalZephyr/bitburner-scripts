import type { NS, AutocompleteData } from "netscript";

import { growAnalyze, numThreads, singleTargetBatchOptions, spawnBatchScript, weakenThreads } from '../lib.js';

const minimumTimeDelta = 20;

const weakenScript = '/batch/weaken.js';
const growScript = '/batch/grow.js';
const hackScript = '/batch/hack.js';

export function autocomplete(data: AutocompleteData, args: string[]): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    const [host, target] = singleTargetBatchOptions(ns);

    ns.kill('monitor.js', target);
    ns.run('monitor.js', 1, target);

    let maxHostThreads = numThreads(ns, host, growScript);

    let script, threads, startTime;

    // TODO: In terms of 100% server money, we need to calculate how much to
    // hack, preferably a small enough amount that we can easily grow back to
    // that amount with a reasonable number of threads.
    const hackTime = ns.getHackTime(target);
    const hackThreads = 100; // for now, we go with a single hack thread

    script = hackScript;
    threads = hackThreads;
    startTime = 0;
    let hackInstance = { script, threads, host, target, startTime };

    const hackSecurityIncrease = ns.hackAnalyzeSecurity(hackThreads, target);
    const postHackWeakenThreads = weakenThreads(hackSecurityIncrease);

    script = weakenScript;
    threads = postHackWeakenThreads;
    startTime = 0;
    let hackWeakenInstance = { script, threads, host, target, startTime };

    const hackShrinkage = ns.hackAnalyze(target) * hackThreads;
    const neededGrowthRatio = 1 / (1 - hackShrinkage);
    ns.print(`hack shrinkage: ${hackShrinkage}`);
    ns.print(`needed recovery growth: ${neededGrowthRatio}`);

    const growTime = ns.getGrowTime(target);
    const growThreads = growAnalyze(ns, target, neededGrowthRatio);

    script = growScript;
    threads = growThreads;
    startTime = 0;
    let growInstance = { script, threads, host, target, startTime };

    // N.B. In order to speculatively calculate how much security will
    // increase, we must _not_ specify the target server. Doing so
    // will cap the projected security growth by the amount of grow
    // threads needed to grow the specified server to max money, and
    // currently we know that server is at max money alread, thus
    // security growth will be reported as zero.
    const growSecurityIncrease = ns.growthAnalyzeSecurity(growThreads);

    const weakenTime = ns.getWeakenTime(target);
    const postGrowWeakenThreads = weakenThreads(growSecurityIncrease);

    script = weakenScript;
    threads = postGrowWeakenThreads;
    startTime = 0;
    let growWeakenInstance = { script, threads, host, target, startTime };

    ns.print(`grow threads: ${growThreads}\n`);
    ns.print(`grow security increase: ${growSecurityIncrease}\n`);
    ns.print(`post grow weaken threads: ${postGrowWeakenThreads}`);

    const totalThreads = hackThreads + postHackWeakenThreads + growThreads + postGrowWeakenThreads;

    if (maxHostThreads > totalThreads && totalThreads > 0) {
        ns.tprint(`
milking ${target} from ${host}:
  ${hackThreads} hack threads
  ${postHackWeakenThreads} post-hack weaken threads
  ${growThreads} grow threads
  ${postGrowWeakenThreads} post-grow weaken threads
`);

        // Calculate script ending times relative to longest running time
        // FIXME: Assume for now that weakenTime > growTime > hackTime

        // Post-hack weaken dictates relative timing of the other scripts
        const postHackWeakenEndTime = weakenTime;
        // Hack should finish delta T before it's weaken.
        const hackEndTime = postHackWeakenEndTime - minimumTimeDelta;
        // Grow should finish delta T after first weaken
        const growEndTime = postHackWeakenEndTime + minimumTimeDelta;
        // Post-grow weaken should finish delta T after it
        const postGrowWeakenEndTime = growEndTime + minimumTimeDelta;

        // Calculate start times using end times and script durations

        // N.B. this should be 0
        const postHackWeakenStartTime = postHackWeakenEndTime - weakenTime;
        // N.B. this should be 2*minimumTimeDelta
        const postGrowWeakenStartTime = postGrowWeakenEndTime - weakenTime;

        const growStartTime = growEndTime - growTime;
        const hackStartTime = hackEndTime - hackTime;

        hackWeakenInstance.startTime = postHackWeakenStartTime;
        spawnBatchScript(ns, hackWeakenInstance);

        growWeakenInstance.startTime = postGrowWeakenStartTime;
        spawnBatchScript(ns, growWeakenInstance);

        growInstance.startTime = growStartTime;
        spawnBatchScript(ns, growInstance);

        hackInstance.startTime = hackStartTime;
        spawnBatchScript(ns, hackInstance);
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
