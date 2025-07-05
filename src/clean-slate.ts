import type { NS } from "netscript";

import { walkNetworkBFS } from 'util/walk';

export async function main(ns: NS) {
    ns.disableLog("ALL");

    let network = walkNetworkBFS(ns);
    let allHosts = new Set(network.keys());

    for (const host of allHosts) {
        ns.killall(host, true);

        let files = ns.ls(host, ".js");
        for (const file of files) {
            if (!ns.rm(file, host)) {
                ns.print(`failed to delete ${file} on ${host}`);
            }
        }
    }
    await clearPorts(ns);
    ns.tprint("finished cleaning the slate");
}


async function clearPorts(ns: NS) {
    let maxPort = 99999;

    for (let i = 1; i <= maxPort; i++) {
        ns.clearPort(i);
        if (i % 500 === 0) {
            await ns.sleep(10);
        }
    }
}
