import type { NS, AutocompleteData } from "netscript";

import { growAnalyze, numThreads, singleTargetBatchOptions, weakenThreads } from '../lib.js';

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
    const growThreads = targetSpec.initialGrowThreads;
    // Calculate weaken time shifted to not include the minimum time
    // delta it needs to end after grow does.
    const weakenTime = targetSpec.weakenTime - minimumTimeDelta;
    const weakenThreads = targetSpec.postGrowWeakenThreads;
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
    initialGrowThreads: number,
    weakenTime: number,
    postGrowWeakenThreads: number,
};

export function analyzeBuildTarget(ns: NS, target: string): GrowSpec {
    const maxMoney = ns.getServerMaxMoney(target);
    const currentMoney = ns.getServerMoneyAvailable(target);

    const neededGrowRatio = currentMoney > 0 ? maxMoney / currentMoney : maxMoney;

    const initialGrowThreads = growAnalyze(ns, target, neededGrowRatio);
    const initialGrowSecurity = ns.growthAnalyzeSecurity(initialGrowThreads, target, 1);
    const postGrowWeakenThreads = weakenThreads(initialGrowSecurity);

    const growTime = ns.getGrowTime(target);
    const weakenTime = ns.getWeakenTime(target);

    return {
        'host': target,
        'growTime': growTime,
        'initialGrowThreads': initialGrowThreads,
        'weakenTime': weakenTime,
        'postGrowWeakenThreads': postGrowWeakenThreads,
    };
}
