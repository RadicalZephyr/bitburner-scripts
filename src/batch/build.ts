import type { NS, AutocompleteData } from "netscript";

import { growthAnalyze, numThreads, singleTargetBatchOptions, weakenThreads } from '../lib.js';

const minimumTimeDelta = 20;

const weakenScript = '/batch/weaken.js';
const growScript = '/batch/grow.js';

export function autocomplete(data: AutocompleteData, args: string[]): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    const [host, target] = singleTargetBatchOptions(ns);

    ns.kill('monitor.js', target);
    ns.run('monitor.js', 1, target);

    let maxHostThreads = numThreads(ns, host, growScript);
    const targetSpec = analyzeBuildTarget(ns, target);

    const growTime = targetSpec.growTime;
    const growThreads = targetSpec.initialGrowthThreads;
    // Calculate weaken time shifted to not include the minimum time
    // delta it needs to end after grow does.
    const weakenTime = targetSpec.weakenTime - minimumTimeDelta;
    const weakenThreads = targetSpec.postGrowthWeakenThreads;
    const totalThreads = growThreads + weakenThreads

    if (maxHostThreads > totalThreads && totalThreads > 0) {
        ns.tprint(`building ${target} with ${growThreads} grow threads and ${weakenThreads} weaken threads on ${host}`);

        const growDelay = weakenTime > growTime ? weakenTime - growTime : 0;
        const weakenDelay = growTime > weakenTime ? growTime - weakenTime : 0;

        if (growThreads > 0) {
            ns.exec(growScript, host, growThreads, target, growDelay);
        }
        if (weakenThreads > 0) {
            ns.exec(weakenScript, host, weakenThreads, target, weakenDelay);
        }
    } else {
        ns.tprint(`
not enough threads to run build on ${host}
trying to run ${growThreads} grow threads and ${weakenThreads} weaken threads
`);
        await ns.sleep(100);
        ns.kill('monitor.js', target);
        if (maxHostThreads < 1) {
            ns.tprint(`not enough RAM available to run grow and weaken on ${host}`);
        }
        if (growThreads < 1 || weakenThreads < 1) {
            ns.tprint(`${target} does not need to be built`);
        }
    }
}

export type GrowSpec = {
    host: string,
    growTime: number,
    initialGrowthThreads: number,
    weakenTime: number,
    postGrowthWeakenThreads: number,
};

export function analyzeBuildTarget(ns: NS, target: string): GrowSpec {
    const maxMoney = ns.getServerMaxMoney(target);
    const currentMoney = ns.getServerMoneyAvailable(target);
    const neededGrowthRatio = maxMoney / currentMoney;
    const initialGrowthThreads = growthAnalyze(ns, target, neededGrowthRatio);
    const initialGrowthSecurity = ns.growthAnalyzeSecurity(initialGrowthThreads, target, 1);

    const postGrowthWeakenThreads = weakenThreads(initialGrowthSecurity);

    const growTime = ns.getGrowTime(target);
    const weakenTime = ns.getWeakenTime(target);

    return {
        'host': target,
        'growTime': growTime,
        'initialGrowthThreads': initialGrowthThreads,
        'weakenTime': weakenTime,
        'postGrowthWeakenThreads': postGrowthWeakenThreads,
    };
}
