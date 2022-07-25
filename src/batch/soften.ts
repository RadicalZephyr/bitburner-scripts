import type { NS, AutocompleteData } from "netscript";

import { numThreads, singleTargetBatchOptions, spawnBatchScript, weakenAnalyze } from '../lib';

const weakenScript = '/batch/weaken.js';

export function autocomplete(data: AutocompleteData, _args: string[]): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    const [host, target] = singleTargetBatchOptions(ns);

    let maxHostThreads = numThreads(ns, host, weakenScript);

    var weakenInstance = calculateWeakenInstance(ns, host, target);

    if (maxHostThreads > 0 && maxHostThreads > weakenInstance.threads) {
        ns.tprint(`softening ${target} with ${weakenInstance.threads} threads on ${host}`);
        spawnBatchScript(ns, weakenInstance);
    } else {
        if (maxHostThreads < 1) {
            ns.tprint(`not enough RAM available to run weaken on ${host}`);
        }

        if (weakenInstance.threads < 1) {
            ns.tprint(`${target} does not need to be weakened`);
        }
    }
}

function calculateWeakenInstance(ns: NS, host: string, target: string) {
    let script = weakenScript;
    let threads = weakenAnalyze(ns, target, 1.0);
    const runTime = ns.getWeakenTime(target);
    return { script, threads, host, target, startTime: 0, runTime };
}
