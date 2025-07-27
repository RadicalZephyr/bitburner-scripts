import { NS } from 'netscript';

import { walkNetworkBFS } from 'util/walk';

/**
 * Kill running scripts across all hosts.
 *
 * If no `targetScripts` are passed then all running scripts will be
 * killed.
 *
 * @param ns            - Netscript API instance
 * @param targetScripts - Scripts to kill, if not specified, all scripts will be killed.
 */
export async function killEverywhere(ns: NS, ...scriptsToKill: string[]) {
    const targetScripts = new Set(scriptsToKill);
    const networkGraph = walkNetworkBFS(ns);
    for (const host of networkGraph.keys()) {
        if (targetScripts.size > 0) {
            ns.ps(host)
                .filter((pi) => targetScripts.has(pi.filename))
                .forEach((pi) => ns.kill(pi.pid));
        } else {
            ns.killall(host, true);
        }
        await ns.asleep(0);
    }
}
