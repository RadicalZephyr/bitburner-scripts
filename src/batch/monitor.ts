import type { NS } from "netscript";

import { exploitableHosts, usableHosts, walkNetworkBFS } from '../lib';

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

        let hosts = usableHosts(ns, allHosts);
        let targets = exploitableHosts(ns, allHosts);
        targets.sort(byLongestTime(ns));

        const maxTargetNameLen = Math.max(...targets.map(t => t.length));

        const baseFormatString = `%${maxTargetNameLen}s | %7s %6s %7s %7s %7s`;
        const headings = ['target', '$: %', '+sec', 'thr(h)', 'thr(g)', 'thr(w)'];

        const dividerFormatString = baseFormatString.replaceAll(' ', '-').replaceAll('%', "%'-");

        const blanks = Array(headings.length).fill('');

        ns.printf(baseFormatString, ...headings);
        ns.printf(dividerFormatString, ...blanks);
        for (const target of targets) {
            const info = targetInfo(ns, hosts, target);
            ns.printf(baseFormatString, ...info);
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

function targetInfo(ns: NS, hosts: string[], target: string): (string | number)[] {
    const maxMoney = ns.getServerMaxMoney(target);
    const minSec = ns.getServerMinSecurityLevel(target);
    let money = ns.getServerMoneyAvailable(target);
    if (money === 0) money = 1;
    const sec = ns.getServerSecurityLevel(target);

    const moneyPercent = (money / maxMoney * 100).toFixed(2);
    const secPlus = (sec - minSec).toFixed(2);

    let hackThreads = 0;
    let growThreads = 0;
    let weakenThreads = 0;

    for (const host of hosts) {
        const pInfos = ns.ps(host);

        pInfos.filter(pi => pi.args.includes(target))
            .forEach(pi => {
                if (pi.filename === '/batch/hack.js') {
                    hackThreads += pi.threads;
                } else if (pi.filename === '/batch/grow.js') {
                    growThreads += pi.threads;
                } else if (pi.filename === '/batch/weaken.js') {
                    weakenThreads += pi.threads;
                }
            });

    }

    return [target, moneyPercent, secPlus, hackThreads, growThreads, weakenThreads];
}
