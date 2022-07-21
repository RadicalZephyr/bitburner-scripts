import type { AutocompleteData, NS } from "netscript";

import { availableHosts, exploitableHosts, getRootAccess, partition, usableHosts } from '../lib.js';
import { walkNetworkBFS } from "../walk-network.js";

// import { analyzeBuildTarget, GrowSpec } from "./build.js";
// import { analyzeMilkTarget, HackSpec } from "./milk.js";
// import { analyzeSoftenTarget, WeakenSpec } from "./soften.js";

export function autocomplete(data: AutocompleteData, args: string[]): string[] {
    return data.servers;
}

const growScript = '/batch/grow.js';
const hackScript = '/batch/hack.js';
const weakenScript = '/batch/weaken.js';

const scriptList = [growScript, hackScript, weakenScript];

export async function main(ns: NS) {
    const flags = ns.flags([
        ['refreshrate', 200],
        ['help', false],
    ]);
    if (flags.help) {
        ns.tprint(`USAGE: run ${ns.getScriptName()} SERVER_NAME

This script prepares a server for batch hacking and then starts continuous batch hacking rounds against it.

OPTIONS
 --refreshrate   Time to sleep between cycles of work assignment
`);
        return;
    }

    let network = walkNetworkBFS(ns);
    let allHosts = Array.from(network.keys());

    const hosts = usableHosts(ns, allHosts);
    let prepTargets = exploitableHosts(ns, allHosts);
    let milkTargets: string[] = [];

    // Deploy all batch scripts to all host servers
    for (const host of hosts) {
        getRootAccess(ns, host);
        await ns.scp(scriptList, host);
    }

    while (true) {
        const currentlyAvailableHosts = availableHosts(ns, hosts);

        const [newMilkTargets, newNonMilkTargets] = partition(prepTargets, (t) => inMilkPhase(ns, t));

        // Filter list of targets
        prepTargets = newNonMilkTargets;
        milkTargets.push(...newMilkTargets);

        await ns.sleep(flags.refreshrate);
    }
}

// type TargetSpec = GrowSpec | HackSpec | WeakenSpec;

// function analyzeTargetPhase(ns: NS, target: string): TargetSpec {
//     if (inMilkPhase(ns, target)) {
//         return analyzeMilkTarget(ns, target);
//     } else if (inBuildPhase(ns, target)) {
//         return analyzeBuildTarget(ns, target);
//     } else if (inSoftenPhase(ns, target)) {
//         return analyzeSoftenTarget(ns, target);
//     } else {
//         ns.print('unable to classify phase for %s', target);
//     }
// }

function inBuildPhase(ns: NS, host: string): boolean {
    return isSecurityMinimum(ns, host) && !isMoneyMaximum(ns, host);
}

function inMilkPhase(ns: NS, host: string): boolean {
    return isSecurityMinimum(ns, host) && isMoneyMaximum(ns, host);
}

function inSoftenPhase(ns: NS, host: string): boolean {
    return !isSecurityMinimum(ns, host);
}

function isMoneyMaximum(ns: NS, host: string): boolean {
    const currentMoney = ns.getServerMoneyAvailable(host);
    const maximumMoney = ns.getServerMaxMoney(host);

    return maximumMoney > currentMoney;
}

function isSecurityMinimum(ns: NS, host: string): boolean {
    const currentSecurity = ns.getServerSecurityLevel(host);
    const minimumSecurity = ns.getServerMinSecurityLevel(host);

    return currentSecurity > minimumSecurity;
}
