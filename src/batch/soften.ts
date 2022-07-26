import type { NS, AutocompleteData } from "netscript";

import { exploitableHosts, spawnBatchScript, weakenAnalyze } from '../lib';
import { walkNetworkBFS } from "../walk-network.js";

const weakenScript = '/batch/weaken.js';

export function autocomplete(data: AutocompleteData, _args: string[]): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    const host = ns.args[0];
    if (typeof host != 'string' || !ns.serverExists(host)) {
        ns.tprintf('invalid host');
        return;
    }

    let network = walkNetworkBFS(ns);
    let allHosts = Array.from(network.keys());
    let targets = exploitableHosts(ns, allHosts);

    targets.sort(byWeakenTime(ns));

    for (const target of targets) {
        var weakenInstance = calculateWeakenInstance(ns, host, target);
        ns.tprint(`softening ${target} with ${weakenInstance.threads} threads on ${host}`);
        spawnBatchScript(ns, weakenInstance);
    }
}

function calculateWeakenInstance(ns: NS, host: string, target: string) {
    let script = weakenScript;
    let threads = weakenAnalyze(ns, target, 1.0);
    const runTime = ns.getWeakenTime(target);
    return { script, threads, host, target, startTime: 0, runTime };
}

function byWeakenTime(ns: NS): ((a: string, b: string) => number) {
    return (a, b) => ns.getWeakenTime(a) - ns.getWeakenTime(b);
}
