import type { AutocompleteData, NS } from "netscript";

import { HOSTS_BY_PORTS_REQUIRED } from "all-hosts";

import { MemoryClient } from "/batch/client/memory";

export function autocomplete(data: AutocompleteData, _args: string[]): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    let memoryClient = new MemoryClient(ns);
    let personalServers = ns.getPurchasedServers();

    for (const hostname of personalServers) {
        await memoryClient.newWorker(hostname);
    }

    let numCrackers = countPortCrackers(ns);
    for (let i = 0; i <= numCrackers; ++i) {
        let workers = HOSTS_BY_PORTS_REQUIRED[i];
        for (const hostname of workers) {
            await memoryClient.newWorker(hostname);
        }
    }
}

const crackers = [
    "BruteSSH.exe",
    "FTPCrack.exe",
    "relaySMTP.exe",
    "HTTPWorm.exe",
    "SQLInject.exe"
];

function countPortCrackers(ns: NS): number {
    let numCrackers = 0;
    for (const c of crackers) {
        if (ns.fileExists(c, "home")) {
            numCrackers += 1;
        }
    }
    return numCrackers;
}
