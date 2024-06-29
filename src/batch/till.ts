import type { NS } from "netscript";

import { EMPTY_SENTINEL, TILL_PORT } from 'util/ports';

const softenScript = "/batch/w.js";

type SoftenPid = {
    pid: number,
    target: string,
};

export async function main(ns: NS) {
    const serverName = ns.getHostname();
    const maxRam = ns.getServerMaxRam(serverName);
    const softenScriptRam = ns.getScriptRam(softenScript, serverName);

    const tillPort = ns.getPortHandle(TILL_PORT);

    let softenPids: SoftenPid[] = [];

    // When should these scripts quit?
    while (true) {
        let availableRam = maxRam - ns.getServerUsedRam(serverName);

        while (availableRam < softenScriptRam) {
            await ns.sleep(1000);
            availableRam = maxRam - ns.getServerUsedRam(serverName);
        }

        let nextTarget = tillPort.read() as string;
        if (nextTarget === EMPTY_SENTINEL) {
            await tillPort.nextWrite();
            continue;
        }

        let softenThreads = softenAnalyze(ns, nextTarget);
        let totalRam = softenScriptRam * softenThreads;

        if (availableRam >= totalRam) {
            // Enough space is available, just launch the script
            let pid = ns.run(softenScript, softenThreads, nextTarget);
            if (pid !== 0) {
                softenPids.push({ pid: pid, target: nextTarget });
            }
        } else {
            let rounds = Math.ceil(totalRam / availableRam);
            let maxThreads = Math.floor(availableRam / softenScriptRam);

            let pid = ns.run(softenScript, maxThreads, nextTarget, 1, rounds);
            if (pid !== 0) {
                softenPids.push({ pid: pid, target: nextTarget });
            }
        }

        await ns.sleep(100);
    }
}

/** Calculate the number of threads needed to soften the `target` by
 * the given multiplier.
 */
export function softenAnalyze(ns: NS, target: string): number {
    const currentSecurity = ns.getServerSecurityLevel(target);
    const minSecurity = ns.getServerMinSecurityLevel(target);
    return softenThreads(currentSecurity - minSecurity);
}

/** Calculate the number of threads to soften any server by the given amount.
 */
export function softenThreads(softenAmount: number): number {
    // We multiply by 20 because 1 thread of weaken reduces security
    // by a fixed amount of 0.05, or 1/20
    return Math.ceil(softenAmount * 20);
}
