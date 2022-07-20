import type { NS, AutocompleteData } from "netscript";

import { growthAnalyze, numThreads, singleTargetBatchOptions, weakenThreads } from '../lib.js';

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
    const targetSpec = analyzeMilkTarget(ns, target);

    const growTime = targetSpec.growTime;
    const hackTime = targetSpec.hackTime;
    const weakenTime = targetSpec.weakenTime;

    const hackThreads = targetSpec.hackThreads;
    const postHackWeakenThreads = targetSpec.postHackWeakenThreads;
    const growThreads = targetSpec.growthThreads;
    const postGrowthWeakenThreads = targetSpec.postGrowthWeakenThreads;

    const totalThreads = hackThreads + postHackWeakenThreads + growThreads + postGrowthWeakenThreads;

    if (maxHostThreads > totalThreads && totalThreads > 0) {
        ns.tprint(`
milking ${target} from ${host}:
  ${hackThreads} hack threads
  ${postHackWeakenThreads} post-hack weaken threads
  ${growThreads} grow threads
  ${postGrowthWeakenThreads} post-grow weaken threads
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

        if (postHackWeakenThreads > 0) {
            ns.exec(weakenScript, host, postHackWeakenThreads, target, postHackWeakenStartTime);
        }
        if (postGrowthWeakenThreads > 0) {
            ns.exec(weakenScript, host, postGrowthWeakenThreads, target, postGrowWeakenStartTime);
        }
        if (growThreads > 0) {
            ns.exec(growScript, host, growThreads, target, growStartTime);
        }
        if (hackThreads > 0) {
            ns.exec(hackScript, host, hackThreads, target, hackStartTime);
        }
    } else {
        ns.tprint(`
not enough threads to run milk on ${host}
trying to run:
  ${hackThreads} hack threads
  ${postHackWeakenThreads} post-hack weaken threads
  ${growThreads} grow threads
  ${postGrowthWeakenThreads} post-grow weaken threads
`);
    }
}

export type HackSpec = {
    host: string,
    growTime: number,
    hackTime: number,
    weakenTime: number,
    hackThreads: number,
    postHackWeakenThreads: number,
    growthThreads: number,
    postGrowthWeakenThreads: number,
};

export function analyzeMilkTarget(ns: NS, target: string): HackSpec {
    // TODO: In terms of 100% server money, we need to calculate how much to
    // hack, preferably a small enough amount that we can easily grow back to
    // that amount with a reasonable number of threads.
    const hackThreads = 500; // for now, we go with a single hack thread
    const hackSecurityIncrease = ns.hackAnalyzeSecurity(hackThreads, target);
    const postHackWeakenThreads = weakenThreads(hackSecurityIncrease);

    const hackShrinkage = ns.hackAnalyze(target) * hackThreads;
    const growthThreads = growthAnalyze(ns, target, 1 / (1 - hackShrinkage));
    const growthSecurityIncrease = ns.growthAnalyzeSecurity(growthThreads, target, 1);
    const postGrowthWeakenThreads = weakenThreads(growthSecurityIncrease);

    const growTime = ns.getGrowTime(target);
    const weakenTime = ns.getWeakenTime(target);
    const hackTime = ns.getHackTime(target);
    return {
        'host': target,
        'growTime': growTime,
        'hackTime': hackTime,
        'weakenTime': weakenTime,
        'hackThreads': hackThreads,
        'postHackWeakenThreads': postHackWeakenThreads,
        'growthThreads': growthThreads,
        'postGrowthWeakenThreads': postGrowthWeakenThreads
    };
}
