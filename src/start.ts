import type { NS } from "netscript";

import { getRootAccess, numThreads, exploitableHosts, usableHosts } from './lib.js';
import { walkNetworkBFS } from "./walk-network.js";

export async function main(ns: NS) {
    const options = ns.flags([
        ['share', false],
        ['share-percent', 0.75]
    ]);

    if (options.help) {
        ns.tprint(`
Usage: ${ns.getScriptName()} [OPTIONS]

OPTIONS
  --share Run share script on usable hosts
  --share_percent Specify the percentage of usable hosts to share [0-1]
`);
        return;
    }
    let shareScript = "share.js";

    if (options.share) {
        let ownedHosts = ns.getPurchasedServers();
        await shareHosts(ns, ownedHosts, shareScript, options.share_percent);
    }

    let hackScript = "hack.js";

    let network = walkNetworkBFS(ns);
    let allHosts = Array.from(network.keys());

    let hosts = usableHosts(ns, allHosts);

    if (options.share) {
        await shareHosts(ns, hosts, shareScript, options.share_percent);
    }

    let targets = exploitableHosts(ns, allHosts);
    ns.tprintf(
        "hosts (%d): [%s]\ntargets (%d): [%s]\n",
        hosts.length, hosts.join(", "),
        targets.length, targets.join(", ")
    );

    await startHosts(ns, hosts, targets, hackScript);
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
            getRootAccess(ns, host);
            await ns.scp(shareScript, host);
            ns.exec(shareScript, host, threads);
        }
    }
}

async function startHosts(ns: NS, hosts: string[], targets: string[], hackScript: string) {
    if (!ns.fileExists(hackScript)) {
        ns.tprintf("hack script '%s' does not exist", hackScript);
        return;
    }

    for (const target of targets) {
        getRootAccess(ns, target);
    }

    let targetIndex = 0;
    let maxSingleTargetThreads = 40;

    for (let i = 0; i < hosts.length; ++i) {
        let host = hosts[i];
        let threads = numThreads(ns, host, hackScript, 1);

        if (threads === 0) {
            continue;
        }

        if (getRootAccess(ns, host)) {
            await ns.scp(hackScript, host);

            if (threads > targets.length * 10) {
                let threadsPerTarget = Math.floor(threads / targets.length);
                for (const target of targets) {
                    ns.exec(hackScript, host, threadsPerTarget, target);
                }
            } else if (threads > maxSingleTargetThreads) {
                while (threads > maxSingleTargetThreads) {
                    let target = targets[targetIndex++ % targets.length];
                    ns.exec(hackScript, host, maxSingleTargetThreads, target);
                    threads -= maxSingleTargetThreads;
                }
                let target = targets[targetIndex++ % targets.length];
                ns.exec(hackScript, host, threads, target);
            } else {
                let target = targets[targetIndex++ % targets.length];
                ns.exec(hackScript, host, threads, target);
            }
        }
    }
}
