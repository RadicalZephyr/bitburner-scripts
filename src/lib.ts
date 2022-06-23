import type { NS } from "netscript";

import { portOpeningPrograms } from "./constants";

/** Check if node is a valid target
 */
export function validTarget(ns: NS, node: any) {
    return typeof (node) == "string" && ns.serverExists(node);
}

/** Calculate the number of threads this script can be run with on this node.
 */
export function numThreads(ns: NS, node: string, hackScript: string, percentage?: number): number {
    percentage = percentage ? percentage : 1.0;
    let hackScriptRam = ns.getScriptRam(hackScript);
    let availableNodeRam = ns.getServerMaxRam(node) - ns.getServerUsedRam(node);
    return Math.floor(availableNodeRam * percentage / hackScriptRam);
}

/** Print the cost breakdown of a server tier with `ram` memory.
 */
export function reportServerComplementCost(ns: NS, ram: number): void {
    let maxServers = ns.getPurchasedServerLimit();
    let serverCost = ns.getPurchasedServerCost(ram);
    let totalCost = maxServers * serverCost;
    ns.tprint("you can buy ", maxServers, " servers with ",
        formatGigaBytes(ram), " of RAM for $",
        formatMoney(serverCost), " per server ",
        "for a total of $", formatMoney(totalCost),
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

    while (maxPerServerSpend > ns.getPurchasedServerCost(ram)) {
        ram *= 2;
    }

    return ram / 2;
}

export function formatMoney(value: number): string {
    var s = ['', 'k', 'm', 'b', 't', 'q'];
    var e = Math.floor(Math.log(value) / Math.log(1000));
    return (value / Math.pow(1000, e)).toFixed(2) + s[e];
}


export function formatGigaBytes(value: number): string {
    var s = ['GB', 'TB', 'PB'];
    var e = Math.floor(Math.log(value) / Math.log(1024));
    return (value / Math.pow(1024, e)).toFixed(0) + s[e];
}

/** Get root access to a server if possible.
 *
 * @returns whether you have root access to the target `host`.
 */
export function getRootAccess(ns: NS, host: string): boolean {
    if (!ns.hasRootAccess(host) && canNuke(ns, host)) {
        let portsNeeded = ns.getServerNumPortsRequired(host);
        let portOpenPrograms = [ns.brutessh, ns.ftpcrack, ns.relaysmtp, ns.httpworm, ns.sqlinject];
        for (let i = 0; i < portsNeeded; ++i) {
            portOpenPrograms[i](host);
        }
        ns.nuke(host);
    }
    return ns.hasRootAccess(host);
}

/** Check if we can hack this host.
 *
 * Note: hacking is different than nuking. Hacking
 * steals money from a server. Nuking only acquires
 * root access, and the hacking skill required is
 * _always_ 1.
 */
export function canHack(ns: NS, host: string): boolean {
    return ns.getHackingLevel() >= ns.getServerRequiredHackingLevel(host)
        && canNuke(ns, host);
}

/** Check if we can nuke this host.
 *
 * Note: hacking is different than nuking. Hacking
 * steals money from a server. Nuking only acquires
 * root access, and the hacking skill required is
 * _always_ 1.
 */
export function canNuke(ns: NS, host: string): boolean {
    if (ns.hasRootAccess(host)) { return true; }

    // Get number of open ports needed
    let portsNeeded = ns.getServerNumPortsRequired(host);

    // Check for existence of enough port opening programs
    for (let i = 0; i < portsNeeded; ++i) {
        if (!ns.fileExists(portOpeningPrograms[i])) {
            return false;
        }
    }
    return true;
}

/** Filter hosts by exploitability.
 */
export function exploitableHosts(ns: NS, hosts: string[]): string[] {
    return hosts.filter((host) => {
        return ns.serverExists(host)
            && canHack(ns, host)
            && hasMoney(ns, host);
    });
}

/** Check if a host has a non-zero money capacity.
 */
function hasMoney(ns: NS, host: string): boolean {
    return ns.getServerMaxMoney(host) > 0;
}

/** Filter hosts by whether they can run scripts.
 */
export function usableHosts(ns: NS, hosts: string[]): string[] {
    return hosts.filter((host) => {
        return ns.serverExists(host)
            && canNuke(ns, host)
            && hasRam(ns, host);
    });
}

function hasRam(ns: NS, host: string): boolean {
    return ns.getServerMaxRam(host) > 0;
}
