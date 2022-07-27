import type { NS } from "netscript";

import { walkNetworkBFS } from "./lib";

const scriptList = ['/loop/grow.js', '/loop/hack.js', '/loop/weaken.js'];

export async function main(ns: NS) {
    let network = walkNetworkBFS(ns);
    let hostNames: string[] = Array.from(network.keys()).filter(h => h !== 'home');

    // Deploy all loop scripts to all servers
    for (const host of hostNames) {
        await ns.scp(scriptList, host);
    }

}
