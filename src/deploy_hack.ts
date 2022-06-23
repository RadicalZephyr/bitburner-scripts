import type { NS } from "netscript";

import { getRootAccess, numThreads, exploitableHosts, usableHosts } from './lib.js';
import { walkNetworkBFS } from "./walk-network.js";

const prepareScript = "prepare.js";

export async function main(ns: NS) {
    let network = walkNetworkBFS(ns);
    let allHosts = Array.from(network.keys());
    let hosts = usableHosts(ns, allHosts);
    let targets = exploitableHosts(ns, allHosts);

    let fastTargets = targets.filter(host => ns.getHackTime(host) < 1000 * 60 * 10);

    ns.tprintf(
        "hosts (%d): [%s]\ntargets (%d): [%s]\n",
        hosts.length, hosts.join(", "),
        fastTargets.length, fastTargets.join(", ")
    );

    for (const host of hosts) {
        getRootAccess(ns, host);
        await ns.scp(prepareScript, host);
        await ns.exec(prepareScript, host, threads)
        // await prepareHost(ns, host);
    }
}

function analyzeTarget(ns: NS, target: string) {
    const currentMoney = ns.getServerMoneyAvailable(target);
    const maxMoney = ns.getServerMaxMoney(target);

    const currentSecurity = ns.getServerSecurityLevel(target);
    const minSecurity = ns.getServerMinSecurityLevel(target);
    const initialWeakenAmount = currentSecurity - minSecurity;
    const initialWeakenThreads = initialWeakenAmount * 20;
}
