import type { NS, AutocompleteData } from "netscript";

import { numThreads, singleTargetBatchOptions, spawnBatchScript, weakenAnalyze } from '../lib';

const weakenScript = '/batch/weaken.js';

export function autocomplete(data: AutocompleteData, args: string[]): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    const [host, target] = singleTargetBatchOptions(ns);

    const delay = 0;

    let maxHostThreads = numThreads(ns, host, weakenScript);

    const threads = weakenAnalyze(ns, target, 1.0);

    if (maxHostThreads > 0 && maxHostThreads > threads) {
        ns.tprint(`softening ${target} with ${threads} threads on ${host}`);
        let script = weakenScript;
        let startTime = delay;
        spawnBatchScript(ns, { script, threads, host, target, startTime });
    } else {
        if (maxHostThreads < 1) {
            ns.tprint(`not enough RAM available to run weaken on ${host}`);
        }

        if (threads < 1) {
            ns.tprint(`${target} does not need to be weakened`);
        }
    }
}
