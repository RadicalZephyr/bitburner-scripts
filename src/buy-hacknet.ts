import type { NS } from "netscript";

export async function main(ns: NS) {
    ns.hacknet.numNodes();
    ns.hacknet.getLevelUpgradeCost(0, 1);
    let max = ns.hacknet.maxNumNodes();
    ns.tprintf("max hacknet nodes %s", max);
}
