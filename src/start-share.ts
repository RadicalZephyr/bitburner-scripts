import type { NS } from 'netscript';
import { ALLOC_ID, MEM_TAG_FLAGS } from 'services/client/memory_tag';
import { parseAndRegisterAlloc } from 'services/client/memory';

import { walkNetworkBFS } from 'util/walk';

export async function main(ns: NS) {
    const options = ns.flags([
        ['share-percent', 0.75],
        ['max-ram', 32],
        ['help', false],
        ...MEM_TAG_FLAGS,
    ]);

    if (
        options.help
        || typeof options['share-percent'] != 'number'
        || typeof options['max-ram'] !== 'number'
    ) {
        ns.tprint(`
Usage: ${ns.getScriptName()} [OPTIONS]

OPTIONS
  --help            Show this help message
  --max-ram RAM     Only run share on servers with RAM less than or equal to RAM
  --share-percent P Specify the percentage of usable hosts to share [0-1]
`);
        return;
    }

    const allocationId = await parseAndRegisterAlloc(ns, options);
    if (options[ALLOC_ID] !== -1 && allocationId === null) {
        return;
    }

    const shareScript = '/share.js';
    const maxRam = options['max-ram'];
    const share_percent = options['share-percent'];

    const ownedHosts = ns.getPurchasedServers();
    await shareHosts(ns, ownedHosts, shareScript, share_percent, maxRam);

    const network = walkNetworkBFS(ns);
    const allHosts = Array.from(network.keys());

    const hosts = usableHosts(ns, allHosts);

    await shareHosts(ns, hosts, shareScript, share_percent, maxRam);
}

async function shareHosts(
    ns: NS,
    hosts: string[],
    shareScript: string,
    shareAmount: number,
    maxRam: number,
) {
    if (!ns.fileExists(shareScript)) {
        ns.tprintf("share script '%s' does not exist", shareScript);
        return;
    }

    for (const host of hosts) {
        if (maxRam < ns.getServerMaxRam(host)) continue;
        const threads = numThreads(ns, host, shareScript, shareAmount);
        if (threads > 0) {
            ns.printf('calculated num threads of %d', threads);
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
export function numThreads(
    ns: NS,
    node: string,
    hackScript: string,
    percentage?: number,
): number {
    percentage = percentage ? percentage : 1.0;
    const hackScriptRam = ns.getScriptRam(hackScript, 'home');
    const availableNodeRam = availableRam(ns, node);
    return Math.floor((availableNodeRam * percentage) / hackScriptRam);
}

/** Filter hosts by whether they can run scripts.
 */
export function usableHosts(ns: NS, hosts: string[]): string[] {
    return hosts.filter((host) => {
        return ns.serverExists(host) && canNuke(ns, host) && hasRam(ns, host);
    });
}

export type PortProgram =
    | 'BruteSSH.exe'
    | 'FTPCrack.exe'
    | 'relaySMTP.exe'
    | 'HTTPWorm.exe'
    | 'SQLInject.exe';
const portOpeningPrograms: PortProgram[] = [
    'BruteSSH.exe',
    'FTPCrack.exe',
    'relaySMTP.exe',
    'HTTPWorm.exe',
    'SQLInject.exe',
];

/** Check if we can nuke this host.
 *
 * Note: hacking is different than nuking. Hacking
 * steals money from a server. Nuking only acquires
 * root access, and the hacking skill required is
 * _always_ 1.
 */
export function canNuke(ns: NS, host: string): boolean {
    if (ns.hasRootAccess(host)) {
        return true;
    }

    // Get number of open ports needed
    const portsNeeded = ns.getServerNumPortsRequired(host);

    // Check for existence of enough port opening programs
    const existingPrograms = portOpeningPrograms.filter((p) =>
        ns.fileExists(p),
    );
    return existingPrograms.length >= portsNeeded;
}

/** Check if a host has non-zero RAM.
 */
export function hasRam(ns: NS, host: string): boolean {
    return ns.getServerMaxRam(host) > 0;
}
