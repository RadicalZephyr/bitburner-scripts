import { portOpeningPrograms } from "./constants";
/** Check if node is a valid target
 */
export function validTarget(ns, node) {
    return typeof (node) == "string" && ns.serverExists(node);
}
/** Calculate the number of threads this script can be run with on this node.
 */
export function numThreads(ns, node, hackScript, percentage) {
    percentage = percentage ? percentage : 1.0;
    let hackScriptRam = ns.getScriptRam(hackScript);
    let availableNodeRam = ns.getServerMaxRam(node) - ns.getServerUsedRam(node);
    return Math.floor(availableNodeRam * percentage / hackScriptRam);
}
/** Print the cost breakdown of a server tier with `ram` memory.
 */
export function reportServerComplementCost(ns, ram) {
    let maxServers = ns.getPurchasedServerLimit();
    let serverCost = ns.getPurchasedServerCost(ram);
    let totalCost = maxServers * serverCost;
    ns.tprint("you can buy ", maxServers, " servers with ", formatGigaBytes(ram), " of RAM for $", formatMoney(serverCost), " per server ", "for a total of $", formatMoney(totalCost));
}
/** Return the maximum amount of ram that can be purchased.
 */
export function getHighestPurchasableRamLevel(ns, percentageSpend) {
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
export function formatMoney(value) {
    var s = ['', 'k', 'm', 'b', 't', 'q'];
    var e = Math.floor(Math.log(value) / Math.log(1000));
    return (value / Math.pow(1000, e)).toFixed(2) + s[e];
}
export function formatGigaBytes(value) {
    var s = ['GB', 'TB', 'PB'];
    var e = Math.floor(Math.log(value) / Math.log(1024));
    return (value / Math.pow(1024, e)).toFixed(0) + s[e];
}
/** Get root access to a server if possible.
 *
 * @returns whether you have root access to the target `host`.
 */
export function getRootAccess(ns, host) {
    if (!ns.hasRootAccess(host) && canNuke(ns, host)) {
        const portOpeningProgramFns = {
            "BruteSSH.exe": ns.brutessh,
            "FTPCrack.exe": ns.ftpcrack,
            "relaySMTP.exe": ns.relaysmtp,
            "HTTPWorm.exe": ns.httpworm,
            "SQLInject.exe": ns.sqlinject,
        };
        for (const program of portOpeningPrograms) {
            if (ns.fileExists(program)) {
                portOpeningProgramFns[program](host);
            }
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
export function canHack(ns, host) {
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
export function canNuke(ns, host) {
    if (ns.hasRootAccess(host)) {
        return true;
    }
    // Get number of open ports needed
    let portsNeeded = ns.getServerNumPortsRequired(host);
    // Check for existence of enough port opening programs
    let existingPrograms = portOpeningPrograms.filter(p => ns.fileExists(p));
    return existingPrograms.length >= portsNeeded;
}
/** Filter hosts by exploitability.
 */
export function exploitableHosts(ns, hosts) {
    return hosts.filter((host) => {
        return ns.serverExists(host)
            && canHack(ns, host)
            && hasMoney(ns, host);
    });
}
/** Check if a host has a non-zero money capacity.
 */
function hasMoney(ns, host) {
    return ns.getServerMaxMoney(host) > 0;
}
/** Filter hosts by whether they can run scripts.
 */
export function usableHosts(ns, hosts) {
    return hosts.filter((host) => {
        return ns.serverExists(host)
            && canNuke(ns, host)
            && hasRam(ns, host);
    });
}
function hasRam(ns, host) {
    return ns.getServerMaxRam(host) > 0;
}
/** Calculate the number of threads needed to grow the server by a
 * certain multiplier.
 */
export function growthAnalyze(ns, target, growthAmount) {
    return Math.ceil(ns.growthAnalyze(target, growthAmount));
}
/** Calculate the number of threads needed to hack the server for a
 * given multiplier.
 */
export function hackAnalyze(ns, target, hackAmount) {
    const oneThreadHackAmount = ns.hackAnalyze(target);
    return Math.ceil(hackAmount / oneThreadHackAmount);
}
/** Calculate the number of threads needed to weaken the `target` by
 * the given multiplier.
 */
export function weakenAnalyze(ns, target, weakenAmount) {
    const currentSecurity = ns.getServerSecurityLevel(target);
    const minSecurity = ns.getServerMinSecurityLevel(target);
    return weakenThreads((currentSecurity - minSecurity) * weakenAmount);
}
/** Calculate the number of threads to weaken any server by the given amount.
 */
export function weakenThreads(weakenAmount) {
    // We multiply by 20 because 1 thread of weaken reduces security
    // by a fixed amount of 0.05, or 1/20
    return Math.ceil(weakenAmount * 20);
}
