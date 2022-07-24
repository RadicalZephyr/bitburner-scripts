import type { NS, AutocompleteData } from "netscript";

import {
    growAnalyze,
    numThreads,
    setInstanceStartTimes,
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

    let growInstance = {
        host,
        target,
        script: '/batch/grow.js',
        threads: growAnalyze(ns, target, neededGrowRatio),
        startTime: 0,
        runTime: ns.getGrowTime(target)
    };

    const growSecurityIncrease = ns.growthAnalyzeSecurity(growInstance.threads, target, 1);

    const weakenInstance = {
        host,
        target,
        script: '/batch/weaken.js',
        threads: weakenThreadsFn(growSecurityIncrease),
        startTime: 0,
        runTime: ns.getWeakenTime(target)
    };

    const scriptInstances = [growInstance, weakenInstance];

    setInstanceStartTimes(scriptInstances);

    const totalThreads = scriptInstances.reduce((sum, i) => sum + i.threads, 0);

    if (maxHostThreads > totalThreads && totalThreads > 0) {
        ns.tprint(`building ${target} with ${growInstance.threads} grow threads and ${weakenInstance.threads} weaken threads on ${host}`);

        scriptInstances.forEach(i => spawnBatchScript(ns, i));
    } else {
        ns.tprint(`
not enough threads to run build on ${host}
trying to run ${growInstance.threads} grow threads and ${weakenInstance.threads} weaken threads
`);
        await ns.sleep(100);
        ns.kill('monitor.js', target);
        if (maxHostThreads < 1) {
            ns.tprint(`not enough RAM available to run grow and weaken on ${host}`);
        }
        if (growInstance.threads < 1 || weakenInstance.threads < 1) {
            ns.tprint(`${target} does not need to be built`);
        }
    }
}
