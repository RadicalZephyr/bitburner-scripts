import type { NS } from "netscript";

import { walkNetworkBFS } from 'util/walk';

export async function main(ns: NS) {
    const options = ns.flags([
        ['share', false],
        ['share_percent', 0.75],
        ['help', false]
    ]);

    if (options.help
        || typeof options.share != 'boolean'
        || typeof options.share_percent != 'number') {
        ns.tprint(`
Usage: ${ns.getScriptName()} [OPTIONS]

OPTIONS
  --help          Show this help message
  --share_percent Specify the percentage of usable hosts to share [0-1]
`);
        return;
    }

    let shareScript = "/share.js";

    let ownedHosts = ns.getPurchasedServers();
    await shareHosts(ns, ownedHosts, shareScript, options.share_percent);

    let network = walkNetworkBFS(ns);
    let allHosts = Array.from(network.keys());

    let hosts = usableHosts(ns, allHosts);

    await shareHosts(ns, hosts, shareScript, options.share_percent);
}

async function shareHosts(ns: NS, hosts: string[], shareScript: string, shareAmount: number) {
    if (!ns.fileExists(shareScript)) {
        ns.tprintf("share script '%s' does not exist", shareScript);
        return;
    }

    for (const host of hosts) {
        let threads = numThreads(ns, host, shareScript, shareAmount);
        if (threads > 0) {
            ns.printf("calculated num threads of %d", threads);
            ns.scp(shareScript, host, 'home');
            ns.exec(shareScript, host, threads);
        }
    }
}

/** Determine total amount of RAM available for running scripts.
 */
export function availableRam(ns: NS, node: string): number {
    return ns.getServerMaxRam(node) - ns.getServerUsedRam(node);
}

/** Calculate the number of threads this script can be run with on this node.
 */
export function numThreads(ns: NS, node: string, hackScript: string, percentage?: number): number {
    percentage = percentage ? percentage : 1.0;
    let hackScriptRam = ns.getScriptRam(hackScript);
    let availableNodeRam = availableRam(ns, node);
    return Math.floor(availableNodeRam * percentage / hackScriptRam);
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

export type PortProgram = "BruteSSH.exe" |
    "FTPCrack.exe" |
    "relaySMTP.exe" |
    "HTTPWorm.exe" |
    "SQLInject.exe"
    ;
const portOpeningPrograms: PortProgram[] = [
    "BruteSSH.exe",
    "FTPCrack.exe",
    "relaySMTP.exe",
    "HTTPWorm.exe",
    "SQLInject.exe"
];

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
    let existingPrograms = portOpeningPrograms.filter(p => ns.fileExists(p));
    return existingPrograms.length >= portsNeeded;
}

/** Check if a host has non-zero RAM.
 */
export function hasRam(ns: NS, host: string): boolean {
    return ns.getServerMaxRam(host) > 0;
}
