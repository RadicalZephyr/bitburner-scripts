import type { NS } from "netscript";

import { walkNetworkBFS } from "./walk-network.js";

const scriptList = ['/batch/grow.js', '/batch/hack.js', '/batch/weaken.js'];

export async function main(ns: NS) {
    let network = walkNetworkBFS(ns);
    let hostNames: string[] = Array.from(network.keys()).filter(h => h !== 'home');

    // Deploy all batch scripts to all servers
    for (const host of hostNames) {
        await ns.scp(scriptList, host);
    }

    ns.run('/batch/manage.js', 1, JSON.stringify(hostNames));
}
