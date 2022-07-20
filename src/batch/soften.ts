import type { NS, AutocompleteData } from "netscript";

import { numThreads, singleTargetBatchOptions, weakenAnalyze } from '../lib';

const weakenScript = '/batch/weaken.js';

export function autocomplete(data: AutocompleteData, args: string[]): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    const [host, target] = singleTargetBatchOptions(ns);

    const delay = 0;

    let maxHostThreads = numThreads(ns, host, weakenScript);
    const targetSpec = analyzeSoftenTarget(ns, target);

    const runThreads = Math.min(maxHostThreads, targetSpec.threads);

    if (runThreads > 0) {
        ns.tprint(`softening ${target} with ${runThreads} threads on ${host}`);
        ns.exec(weakenScript, host, runThreads, target, delay);
    } else {
        if (maxHostThreads < 1) {
            ns.tprint(`not enough RAM available to run weaken on ${host}`);
        }

        if (targetSpec.threads < 1) {
            ns.tprint(`${target} does not need to be weakened`);
        }
    }
}

export type WeakenInstance = {
    host: string,
    pid: number,
    threads: number,
};

export type WeakenSpec = {
    host: string,
    threads: number,
    time: number,
};

export function analyzeSoftenTarget(ns: NS, target: string): WeakenSpec {
    const threads = weakenAnalyze(ns, target, 1.0);
    const time = ns.getWeakenTime(target);
    return {
        'host': target,
        'threads': threads,
        'time': time
    };
}
