import type { NS } from "netscript";

export async function main(ns: NS) {
    const numNodes = ns.hacknet.numNodes();

    for (let i = 0; i < numNodes; ++i) {
        const stats = ns.hacknet.getNodeStats(i);
        ns.tprintf('node %s:\n%s', i, JSON.stringify(stats));
    }
}
