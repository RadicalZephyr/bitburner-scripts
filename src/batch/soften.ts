import type { NS, AutocompleteData } from "netscript";

import { availableHosts, numThreads, usableHosts, weakenAnalyze } from '../lib';
import { walkNetworkBFS } from "../walk-network.js";

const weakenScript = '/batch/weaken.js';

export function autocomplete(data: AutocompleteData, args: string[]): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    const target = ns.args[0];
    if (typeof target != 'string' || ns.serverExists(target)) {
        ns.printf('invalid target');
        return;
    }

    let network = walkNetworkBFS(ns);
    let allHosts = Array.from(network.keys());

    const hosts = availableHosts(ns, usableHosts(ns, allHosts));

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
