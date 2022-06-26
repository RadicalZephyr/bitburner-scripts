import { growthAnalyze, weakenThreads } from '../lib.js';
export async function main(ns) {
    const hostsJSON = ns.args[0];
    if (typeof hostsJSON != 'string') {
        ns.printf('invalid hosts list');
        return;
    }
    const hosts = JSON.parse(hostsJSON);
    const targetsJSON = ns.args[1];
    if (typeof targetsJSON != 'string') {
        ns.printf('invalid targets list');
        return;
    }
    const targets = JSON.parse(targetsJSON);
    // Calculate growth, weaken and hack details for all targets
    const targetSpecs = targets.map(t => analyzeMilkTarget(ns, t));
}
function analyzeMilkTarget(ns, target) {
    // TODO: In terms of 100% server money, we need to calculate how much to
    // hack, preferably a small enough amount that we can easily grow back to
    // that amount with a reasonable number of threads.
    const hackThreads = 1; // for now, we go with a single hack thread
    const hackSecurityIncrease = ns.hackAnalyzeSecurity(hackThreads, target);
    const postHackWeakenThreads = weakenThreads(hackSecurityIncrease);
    const hackShrinkage = ns.hackAnalyze(target) * hackThreads;
    const growthThreads = growthAnalyze(ns, target, 1 / (1 - hackShrinkage));
    const growthSecurityIncrease = ns.growthAnalyzeSecurity(growthThreads, target);
    const postGrowthWeakenThreads = weakenThreads(growthSecurityIncrease);
    return {
        'hackThreads': hackThreads,
        'postHackWeakenThreads': postHackWeakenThreads,
        'growthThreads': growthThreads,
        'postGrowthWeakenThreads': postGrowthWeakenThreads
    };
}
