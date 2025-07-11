import type { NS } from "netscript";

import { walkNetworkBFS } from 'util/walk';

export async function main(ns: NS) {
    ns.disableLog("ALL");

    let network = walkNetworkBFS(ns);
    let allHosts = new Set(network.keys());

    for (const host of allHosts) {
        let files = ns.ls(host, ".js");
        for (const file of files) {
            if (!ns.rm(file, host)) {
                ns.print(`failed to delete ${file} on ${host}`);
            }
        }
    }
}
