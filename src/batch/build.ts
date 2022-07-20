import type { NS, AutocompleteData } from "netscript";

import { growthAnalyze, numThreads, singleTargetBatchOptions, weakenThreads } from '../lib.js';

const weakenScript = '/batch/weaken.js';
const growScript = '/batch/grow.js';

export function autocomplete(data: AutocompleteData, args: string[]): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    const [host, target] = singleTargetBatchOptions(ns);

    const delay = 0;

    ns.kill('monitor.js', target);
    ns.run('monitor.js', 1, target);

    let maxHostThreads = numThreads(ns, host, growScript);
    const targetSpec = analyzeBuildTarget(ns, target);

    const growThreads = targetSpec.initialGrowthThreads;
    const weakenThreads = targetSpec.postGrowthWeakenThreads;
    const totalThreads = growThreads + weakenThreads
    if (maxHostThreads > totalThreads && totalThreads > 0) {
        ns.tprint(`building ${target} with ${growThreads} grow threads and ${weakenThreads} weaken threads on ${host}`);
        if (growThreads > 0) {
            ns.exec(weakenScript, host, weakenThreads, target, delay);
        }
        if (weakenThreads > 0) {
            ns.exec(growScript, host, growThreads, target, delay);
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
    initialGrowthThreads: number,
    postGrowthWeakenThreads: number,
};

export function analyzeBuildTarget(ns: NS, target: string): GrowSpec {
    const maxMoney = ns.getServerMaxMoney(target);
    const currentMoney = ns.getServerMoneyAvailable(target);
    const neededGrowthRatio = maxMoney / currentMoney;
    const initialGrowthThreads = growthAnalyze(ns, target, neededGrowthRatio);
    const initialGrowthSecurity = ns.growthAnalyzeSecurity(initialGrowthThreads, target, 1);

    const postGrowthWeakenThreads = weakenThreads(initialGrowthSecurity);

    return {
        'host': target,
        'initialGrowthThreads': initialGrowthThreads,
        'postGrowthWeakenThreads': postGrowthWeakenThreads,
    };
}
