import type { NS, AutocompleteData } from "netscript";

import { byWeakenTime, calculateWeakenInstance, softenableHosts, spawnBatchScript, walkNetworkBFS } from '../lib';

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
    let targets = softenableHosts(ns, allHosts);

    targets.sort(byWeakenTime(ns));

    for (const target of targets) {
        var weakenInstance = calculateWeakenInstance(ns, target);
        ns.tprint(`softening ${target} with ${weakenInstance.threads} threads on ${host}`);
        spawnBatchScript(ns, host, weakenInstance);
    }
}
