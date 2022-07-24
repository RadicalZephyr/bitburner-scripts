import type { NS } from "netscript";

import { walkNetworkBFS } from './walk-network.js';

export async function main(ns: NS) {
    const networkGraph = walkNetworkBFS(ns);
    for (const host of networkGraph.keys()) {
        ns.killall(host, true);
    }
}
