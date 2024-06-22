import type { NS } from "netscript";

//////////////////////////////////////////
// Server Purchase Utilities
//////////////////////////////////////////

export const GB = 1000000000;

/** Print the cost breakdown of a server tier with `ram` memory.
 */
export function reportServerComplementCost(ns: NS, ram: number): void {
    let maxServers = ns.getPurchasedServerLimit();
    let serverCost = ns.getPurchasedServerCost(ram);
    let totalCost = maxServers * serverCost;
    ns.tprintf("you can buy %s servers with %s of RAM for %s per server for a total of %s",
        maxServers,
        ns.nFormat(ram * GB, '0b'),
        ns.nFormat(serverCost, '$0a'),
        ns.nFormat(totalCost, '$0a'),
    );
}

/** Return the maximum amount of ram that can be purchased.
 */
export function getHighestPurchasableRamLevel(ns: NS, percentageSpend: number): number {
    let maxServers = ns.getPurchasedServerLimit();
    let maxServerTierSpend = ns.getServerMoneyAvailable("home") * percentageSpend;
    let maxPerServerSpend = maxServerTierSpend / maxServers;
    let maxServerRam = ns.getPurchasedServerMaxRam();

    let ram = 16;

    while (ram * 2 <= maxServerRam && maxPerServerSpend > ns.getPurchasedServerCost(ram)) {
        ram *= 2;
    }

    return ram / 2;
}
