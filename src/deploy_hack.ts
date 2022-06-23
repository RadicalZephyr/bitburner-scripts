import type { NS } from "netscript";

import { growthAnalyze, hackAnalyze, weakenAnalyze, weakenThreads, getRootAccess, numThreads, exploitableHosts, usableHosts } from './lib.js';
import { walkNetworkBFS } from "./walk-network.js";

const prepareScript = "prepare.js";

const scripts = {
    'runner': 'batch-runner.js',
    'grow': 'batch-grow.js',
    'hack': 'batch-hack.js',
    'weaken': 'batch-weaken.js'
};
const scriptList = [scripts.runner, scripts.grow, scripts.hack, scripts.weaken];

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
        await ns.scp(scriptList, host);
    }
}

type ServerDetails = {
    initialWeakenThreads: number,
    initialGrowthThreads: number,
    postGrowthWeakenThreads: number,
};

function analyzeTargetPreparation(ns: NS, target: string): ServerDetails {
    const initialWeakenThreads = weakenAnalyze(ns, target, 1.0);

    const maxMoney = ns.getServerMaxMoney(target);
    const currentMoney = ns.getServerMoneyAvailable(target);
    const neededGrowthRatio = maxMoney / currentMoney;
    const initialGrowthThreads = growthAnalyze(ns, target, neededGrowthRatio);
    const initialGrowthSecurity = ns.growthAnalyzeSecurity(initialGrowthThreads, target);

    const postGrowthWeakenThreads = weakenThreads(initialGrowthSecurity);

    return {
        'initialWeakenThreads': initialWeakenThreads,
        'initialGrowthThreads': initialGrowthThreads,
        'postGrowthWeakenThreads': postGrowthWeakenThreads,
    };
}
