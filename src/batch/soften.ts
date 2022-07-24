import type { NS, AutocompleteData } from "netscript";

import { numThreads, singleTargetBatchOptions, spawnBatchScript, weakenAnalyze } from '../lib';

const weakenScript = '/batch/weaken.js';

export function autocomplete(data: AutocompleteData, _args: string[]): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    const [host, target] = singleTargetBatchOptions(ns);

    let maxHostThreads = numThreads(ns, host, weakenScript);

    let script = weakenScript;
    let threads = weakenAnalyze(ns, target, 1.0);
    const runTime = ns.getWeakenTime(target);
    const weakenInstance = { script, threads, host, target, startTime: 0, runTime };

    if (maxHostThreads > 0 && maxHostThreads > threads) {
        ns.tprint(`softening ${target} with ${threads} threads on ${host}`);
        spawnBatchScript(ns, weakenInstance);
    } else {
        if (maxHostThreads < 1) {
            ns.tprint(`not enough RAM available to run weaken on ${host}`);
        }

        if (threads < 1) {
            ns.tprint(`${target} does not need to be weakened`);
        }
    }
}
