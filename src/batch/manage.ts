import type { NS, Server } from "netscript";

const scripts = {
    'grow': { 'name': '/batch/grow.js', 'ram': 0 },
    'hack': { 'name': '/batch/hack.js', 'ram': 0 },
    'weaken': { 'name': '/batch/weaken.js', 'ram': 0 }
};

export async function main(ns: NS) {
    const hostsJSON = ns.args[0];
    if (typeof hostsJSON != 'string') {
        ns.printf('invalid hosts list');
        return;
    }
    let servers: Server[] = JSON.parse(hostsJSON);

    scripts.grow.ram = ns.getScriptRam(scripts.grow.name);
    scripts.hack.ram = ns.getScriptRam(scripts.hack.name);
    scripts.weaken.ram = ns.getScriptRam(scripts.weaken.name);

    let usableServers = servers.filter(s => canNuke(ns, s));
    usableServers.sort(byAvailableRam);

    const totalAvailableRam = usableServers.map(s => s.maxRam - s.ramUsed).reduce((acc, x) => acc + x);

    let exploitableServers = servers.filter(s => hasMoney(ns, s));
    let currentlyExploitableServers = exploitableServers.filter(s => canHack(ns, s));

    currentlyExploitableServers.sort(bySoftest);

    let softenSpecs = currentlyExploitableServers.map(s => analyzeSoftenTarget(ns, target));

    let weakenProcesses = [];
    for (const spec of softenSpecs) {
        let remainingThreads = spec.threads;

        while (remainingThreads > 0 && usableServers.length > 0) {
            let server = usableServers[0];
            let availableThreads = getAvailableThreads(ns, server, scripts.weaken.ram);

            if (remainingThreads > availableThreads) {
                const pid = ns.exec(scripts.weaken.name, server.ip, availableThreads, spec.host);
                if (pid != 0) {
                    remainingThreads -= availableThreads;
                    usableServers.shift();
                    weakenProcesses.push({ 'pid': pid, 'host': server.ip });
                }
            } else {
                const pid = ns.exec(scripts.weaken.name, server.ip, remainingThreads, spec.host);
                if (pid != 0) {
                    remainingThreads = 0;
                    weakenProcesses.push({ 'pid': pid, 'host': server.ip });
                }
            }
        }

        if (usableServers.length == 0) {
            break;
        }
    }
}

function byAvailableRam(a: Server, b: Server): number {
    return (a.maxRam - a.ramUsed) - (b.maxRam - b.ramUsed);
}

function bySoftest(a: Server, b: Server): number {
    return (a.hackDifficulty - a.minDifficulty) - (b.hackDifficulty - b.minDifficulty);
}

function getAvailableThreads(ns: NS, server: Server, ram: number) {
    const availableRam = server.maxRam - ns.getServerUsedRam(server.ip);
    return Math.floor(availableRam / ram);
}

type WeakenTargetSpec = {
    host: string,
    ram: number,
    threads: number,
    time: number,
};

function analyzeSoftenTarget(ns: NS, target: Server): WeakenTargetSpec {
    const threads = weakenAnalyze(ns, target, 1.0);
    const time = ns.getWeakenTime(target.ip);
    return {
        'host': target,
        'ram': threads * scripts.weaken.ram,
        'threads': threads,
        'time': time
    };
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
export function weakenAnalyze(ns: NS, target: Server, weakenAmount: number): number {
    const currentSecurity = target.hackDifficulty;
    const minSecurity = target.minDifficulty;
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
