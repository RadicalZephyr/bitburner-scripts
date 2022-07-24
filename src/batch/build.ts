import type { NS, AutocompleteData } from "netscript";

import { growAnalyze, numThreads, singleTargetBatchOptions, spawnBatchScript, weakenThreads as weakenThreadsFn } from '../lib.js';

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

    const maxMoney = ns.getServerMaxMoney(target);
    const currentMoney = ns.getServerMoneyAvailable(target);

    const neededGrowRatio = currentMoney > 0 ? maxMoney / currentMoney : maxMoney;

    const growTime = ns.getGrowTime(target);
    const growThreads = growAnalyze(ns, target, neededGrowRatio);

    const growSecurityIncrease = ns.growthAnalyzeSecurity(growThreads, target, 1);

    const weakenTime = ns.getWeakenTime(target);
    const weakenThreads = weakenThreadsFn(growSecurityIncrease);

    const totalThreads = growThreads + weakenThreads

    // Calculate weaken end time shifted to not include the minimum
    // time delta it needs to end after grow does.
    const weakenEndTime = weakenTime - minimumTimeDelta;

    if (maxHostThreads > totalThreads && totalThreads > 0) {
        ns.tprint(`building ${target} with ${growThreads} grow threads and ${weakenThreads} weaken threads on ${host}`);

        const growDelay = weakenEndTime > growTime ? weakenEndTime - growTime : 0;
        const weakenDelay = growTime > weakenEndTime ? growTime - weakenEndTime : 0;

        let script, threads, startTime;
        script = growScript;
        threads = growThreads;
        startTime = growDelay;
        spawnBatchScript(ns, { script, threads, host, target, startTime });

        script = weakenScript;
        threads = weakenThreads;
        startTime = weakenDelay;
        spawnBatchScript(ns, { script, threads, host, target, startTime });
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
