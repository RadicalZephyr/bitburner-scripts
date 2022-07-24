import type { NS, AutocompleteData } from "netscript";

import {
    endTime,
    growAnalyze,
    numThreads,
    singleTargetBatchOptions,
    spawnBatchScript,
    weakenThreads as weakenThreadsFn
} from '../lib.js';

const minimumTimeDelta = 50;

export function autocomplete(data: AutocompleteData, args: string[]): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    const [host, target] = singleTargetBatchOptions(ns);

    ns.kill('monitor.js', target);
    ns.run('monitor.js', 1, target);

    let maxHostThreads = numThreads(ns, host, '/batch/grow.js');

    const maxMoney = ns.getServerMaxMoney(target);
    const currentMoney = ns.getServerMoneyAvailable(target);

    const neededGrowRatio = currentMoney > 0 ? maxMoney / currentMoney : maxMoney;

    const growThreads = growAnalyze(ns, target, neededGrowRatio);

    let growInstance = {
        host,
        target,
        script: '/batch/grow.js',
        threads: growThreads,
        startTime: 0,
        runTime: ns.getGrowTime(target)
    };

    const growSecurityIncrease = ns.growthAnalyzeSecurity(growThreads, target, 1);

    const weakenThreads = weakenThreadsFn(growSecurityIncrease);

    let weakenInstance = {
        host,
        target,
        script: '/batch/weaken.js',
        threads: weakenThreads,
        startTime: 0,
        runTime: ns.getWeakenTime(target)
    };

    const scriptInstances = [growInstance, weakenInstance];

    const totalThreads = scriptInstances.reduce((sum, i) => sum + i.threads, 0);

    if (maxHostThreads > totalThreads && totalThreads > 0) {
        ns.tprint(`building ${target} with ${growThreads} grow threads and ${weakenThreads} weaken threads on ${host}`);

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
