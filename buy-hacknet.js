/** @param {NS} ns */
export async function main(ns) {
    let max = ns.hacknet.maxNumNodes();
    ns.tprintf("max hacknet nodes %s", max);
}
