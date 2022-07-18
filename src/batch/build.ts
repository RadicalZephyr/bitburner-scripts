import type { NS } from "netscript";

import { growthAnalyze, weakenThreads } from '../lib.js';

export async function main(ns: NS) {
    const hostsJSON = ns.args[0];
    if (typeof hostsJSON != 'string') {
        ns.printf('invalid hosts list');
        return;
    }
    const hosts: string[] = JSON.parse(hostsJSON);

    const targetsJSON = ns.args[1];
    if (typeof targetsJSON != 'string') {
        ns.printf('invalid targets list');
        return;
    }
    const targets: string[] = JSON.parse(targetsJSON);

    // Calculate growth and weaken details for all targets
    const targetSpecs = targets.map(t => analyzeBuildTarget(ns, t));
}

export type GrowSpec = {
    host: string,
    initialGrowthThreads: number,
    postGrowthWeakenThreads: number,
};

export function analyzeBuildTarget(ns: NS, target: string): GrowSpec {
    const maxMoney = ns.getServerMaxMoney(target);
    const currentMoney = ns.getServerMoneyAvailable(target);
    const neededGrowthRatio = maxMoney / currentMoney;
    const initialGrowthThreads = growthAnalyze(ns, target, neededGrowthRatio);
    const initialGrowthSecurity = ns.growthAnalyzeSecurity(initialGrowthThreads, target);

    const postGrowthWeakenThreads = weakenThreads(initialGrowthSecurity);

    return {
        'host': target,
        'initialGrowthThreads': initialGrowthThreads,
        'postGrowthWeakenThreads': postGrowthWeakenThreads,
    };
}
