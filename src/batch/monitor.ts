import type { NS } from "netscript";

import { buildableHosts, milkableHosts, softenableHosts, usableHosts, walkNetworkBFS } from '../lib';

export async function main(ns: NS) {
    const flags = ns.flags([
        ['refreshrate', 200],
        ['help', false],
    ]);

    if (flags.help) {
        ns.tprint(`
This script helps visualize what's going on with your batch hacking.

USAGE: run ${ns.getScriptName()}

OPTIONS:
  --refreshrate  Time to wait between display updates in milliseconds
  --help         Show this help message

Example:
  > run ${ns.getScriptName()}
`);

        return;
    }
    ns.tail();
    ns.disableLog('ALL');

    let network = walkNetworkBFS(ns);
    let allHosts = Array.from(network.keys());

    while (true) {
        ns.clearLog();

        const targetThreads = countThreadsByTarget(ns, allHosts);

        let hosts = usableHosts(ns, allHosts);
        let softenTargets = softenableHosts(ns, allHosts);
        softenTargets.sort(byLongestTime(ns));

        let buildTargets = buildableHosts(ns, allHosts);
        buildTargets.sort(byLongestTime(ns));

        let milkTargets = milkableHosts(ns, allHosts);
        milkTargets.sort(byLongestTime(ns));

        type TargetCategories = [
            category: string,
            targets: string[]
        ];
        const targetCategories: TargetCategories[] = [
            ["Soften", softenTargets],
            ["Build", buildTargets],
            ["Milk", milkTargets]
        ];

        for (const [category, targets] of targetCategories) {
            if (targets.length == 0) continue;

            const maxTargetNameLen = Math.max(...targets.map(t => t.length));

            const baseFormatString = `%${maxTargetNameLen}s | %7s %6s %7s %7s %7s`;
            const headings = ['target', '$: %', '+sec', 'thr(h)', 'thr(g)', 'thr(w)'];

            const dividerFormatString = baseFormatString.replaceAll(' ', '-').replaceAll('%', "%'-");

            const blanks = Array(headings.length).fill('');

            ns.printf('\n%s Targets:', category);
            ns.printf(baseFormatString, ...headings);
            ns.printf(dividerFormatString, ...blanks);
            for (const target of targets) {
                const info = targetInfo(ns, target, targetThreads.get(target));
                ns.printf(baseFormatString, ...info);
            }
        }
        await ns.sleep(flags.refreshrate);
    }
}

function byLongestTime(ns: NS): ((a: string, b: string) => number) {
    return (a, b) => longestTime(ns, a) - longestTime(ns, b);
}

function longestTime(ns: NS, host: string): number {
    return Math.max(ns.getHackTime(host), ns.getGrowTime(host), ns.getWeakenTime(host));
}

class TargetThreads {
    hack: number;
    grow: number;
    weaken: number;

    constructor() {
        this.hack = 0;
        this.grow = 0;
        this.weaken = 0;
    }
}

function countThreadsByTarget(ns: NS, hosts: string[]): Map<string, TargetThreads> {
    let targetThreads = new Map(hosts.map(h => [h, new TargetThreads()]));

    for (const host of hosts) {
        for (const pi of ns.ps(host)) {

            let target = pi.args[0] === '--loop' ? pi.args[1] : pi.args[0];
            let targetThread = targetThreads.get(target);

            if (pi.filename === '/batch/hack.js') {
                targetThread.hack += pi.threads;
            } else if (pi.filename === '/batch/grow.js') {
                targetThread.grow += pi.threads;
            } else if (pi.filename === '/batch/weaken.js') {
                targetThread.weaken += pi.threads;
            }
        }
    }

    return targetThreads;
}

function targetInfo(ns: NS, target: string, targetThreads: TargetThreads): (string | number)[] {
    const maxMoney = ns.getServerMaxMoney(target);
    const minSec = ns.getServerMinSecurityLevel(target);
    let money = ns.getServerMoneyAvailable(target);
    if (money === 0) money = 1;
    const sec = ns.getServerSecurityLevel(target);

    const moneyPercent = (money / maxMoney * 100).toFixed(2);
    const secPlus = (sec - minSec).toFixed(2);

    return [target, moneyPercent, secPlus, targetThreads.hack, targetThreads.grow, targetThreads.weaken];
}
