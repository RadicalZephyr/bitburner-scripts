import type { NS, Server } from "netscript";

export async function main(ns: NS) {
    const hostsJSON = ns.args[0];
    if (typeof hostsJSON != 'string') {
        ns.printf('invalid hosts list');
        return;
    }
    let servers: Server[] = JSON.parse(hostsJSON);

    usabl
    let usableServers = servers.filter(s => canNuke(ns, s));
    usableServers.sort(byAvailableRam);

    let exploitableServers = servers.filter(s => hasMoney(ns, s));
    let currentlyExploitableServers = exploitableServers.filter(s => canHack(ns, s));

    currentlyExploitableServers.sort(bySoftest);
}

function byAvailableRam(a: Server, b: Server): number {
    return (a.maxRam - a.ramUsed) - (b.maxRam - b.ramUsed);
}

function bySoftest(a: Server, b: Server): number {
    return (a.hackDifficulty - a.baseDifficulty) - (b.hackDifficulty - b.baseDifficulty);
}

/** Check if we can hack this server.
 *
 * Note: hacking is different than nuking. Hacking
 * steals money from a server. Nuking only acquires
 * root access, and the hacking skill required is
 * _always_ 1.
 */
export function canHack(ns: NS, server: Server): boolean {
    return ns.getHackingLevel() >= server.hackDifficulty
        && canNuke(ns, server);
}


/** Check if we can nuke this server.
 *
 * Note: hacking is different than nuking. Hacking
 * steals money from a server. Nuking only acquires
 * root access, and the hacking skill required is
 * _always_ 1.
 */
export function canNuke(ns: NS, server: Server): boolean {
    if (server.hasAdminRights) { return true; }

    // Get number of open ports needed
    let portsNeeded = server.numOpenPortsRequired;

    // Check for existence of enough port opening programs
    let existingPrograms = portOpeningPrograms.filter(p => ns.fileExists(p));
    return existingPrograms.length >= portsNeeded;
}

/** Filter servers by exploitability.
 */
export function exploitableServers(ns: NS, servers: Server[]): Server[] {
    return servers.filter((server) => {
        return canHack(ns, server)
            && hasMoney(ns, server);
    });
}

/** Check if a server has a non-zero money capacity.
 */
function hasMoney(ns: NS, server: Server): boolean {
    return server.moneyMax > 0;
}

/** Filter servers by whether they can run scripts.
 */
export function usableServers(ns: NS, servers: Server[]): Server[] {
    return servers.filter((server) => {
        return canNuke(ns, server)
            && hasRam(ns, server);
    });
}

function hasRam(ns: NS, server: Server): boolean {
    return server.maxRam > 0;
}

/** Calculate the number of threads needed to grow the server by a
 * certain multiplier.
 */
export function growthAnalyze(ns: NS, target: string, growthAmount: number): number {
    return Math.ceil(ns.growthAnalyze(target, growthAmount));
}

/** Calculate the number of threads needed to hack the server for a
 * given multiplier.
 */
export function hackAnalyze(ns: NS, target: string, hackAmount: number): number {
    const oneThreadHackAmount = ns.hackAnalyze(target);
    return Math.ceil(hackAmount / oneThreadHackAmount);
}

/** Calculate the number of threads needed to weaken the `target` by
 * the given multiplier.
 */
export function weakenAnalyze(ns: NS, target: string, weakenAmount: number): number {
    const currentSecurity = ns.getServerSecurityLevel(target);
    const minSecurity = ns.getServerMinSecurityLevel(target);
    return weakenThreads((currentSecurity - minSecurity) * weakenAmount);
}

/** Calculate the number of threads to weaken any server by the given amount.
 */
export function weakenThreads(weakenAmount: number): number {
    // We multiply by 20 because 1 thread of weaken reduces security
    // by a fixed amount of 0.05, or 1/20
    return Math.ceil(weakenAmount * 20);
}

export type PortProgram = "BruteSSH.exe" |
    "FTPCrack.exe" |
    "relaySMTP.exe" |
    "HTTPWorm.exe" |
    "SQLInject.exe"
    ;
export const portOpeningPrograms: PortProgram[] = [
    "BruteSSH.exe",
    "FTPCrack.exe",
    "relaySMTP.exe",
    "HTTPWorm.exe",
    "SQLInject.exe"
];
