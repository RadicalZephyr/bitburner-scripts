/** Check if node is a valid target
 *
 * @param {NS} ns
 * @param {any} node
 */
export function validTarget(ns, node) {
    return typeof (node) == "string" && ns.serverExists(node);
}
/** Calculate the number of threads this script can be run with on this node.
 *
 * @param {NS} ns
 * @param {string} node
 * @param {number} hackScript
 * @param {number} percentage
 */
export function numThreads(ns, node, hackScript, percentage) {
    percentage = percentage ? percentage : 1.0;
    let hackScriptRam = ns.getScriptRam(hackScript);
    let availableNodeRam = ns.getServerMaxRam(node) - ns.getServerUsedRam(node);
    return Math.floor(availableNodeRam * percentage / hackScriptRam);
}
/** Print the cost breakdown of a server tier with `ram` memory.
 *
 * @param {NS} ns
 * @param {number} ram
 */
export function reportServerComplementCost(ns, ram) {
    let maxServers = ns.getPurchasedServerLimit();
    let serverCost = ns.getPurchasedServerCost(ram);
    let totalCost = maxServers * serverCost;
    ns.tprint("you can buy ", maxServers, " servers with ", formatGigaBytes(ram), " of RAM for $", formatMoney(serverCost), " per server ", "for a total of $", formatMoney(totalCost));
}
/** @param {NS} ns */
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
 * @param {NS} ns
 * @param {string} host
 */
export function getRootAccess(ns, host) {
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
 *
 * @param {NS} ns
 * @param {string} host
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
 *
 * @param {NS} ns
 * @param {string} host
 */
export function canNuke(ns, host) {
    if (ns.hasRootAccess(host)) {
        return true;
    }
    // Get number of open ports needed
    let portsNeeded = ns.getServerNumPortsRequired(host);
    // Check for existence of enough port opening programs
    let portOpeningPrograms = ["BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe", "HTTPWorm.exe", "SQLInject.exe"];
    for (let i = 0; i < portsNeeded; ++i) {
        if (!ns.fileExists(portOpeningPrograms[i])) {
            return false;
        }
    }
    return true;
}
/** Filter hosts by exploitability.
 *
 * @param {NS} ns
 * @param {string[]} hosts
 */
export function exploitableHosts(ns, hosts) {
    return hosts.filter((host) => {
        return ns.serverExists(host)
            && canHack(ns, host)
            && hasMoney(ns, host);
    });
}
/** Check if a host has a non-zero money capacity.
 *
 * @param {NS} ns
 * @param {string} host
 */
function hasMoney(ns, host) {
    return ns.getServerMaxMoney(host) > 0;
}
/** Filter hosts by whether they can run scripts.
 *
 * @param {NS} ns
 * @param {string} host
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
