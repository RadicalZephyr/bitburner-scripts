import type { NS } from "netscript";

import { exploitableHosts, usableHosts } from '../lib.js';
import { walkNetworkBFS } from "../walk-network.js";

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

        // let hosts = usableHosts(ns, allHosts);
        let targets = exploitableHosts(ns, allHosts);

        const maxTargetNameLen = Math.max(...targets.map(t => t.length));

        const baseFormatString = `%${maxTargetNameLen}s | %7s %6s %7s %7s %7s`;
        const headings = ['target', '$: %', '+sec', 'thr(h)', 'thr(g)', 'thr(w)'];

        const dividerFormatString = baseFormatString.replaceAll(' ', '-').replaceAll('%', "%'-");

        const blanks = Array(headings.length).fill('');

        ns.printf(baseFormatString, ...headings);
        ns.printf(dividerFormatString, ...blanks);
        for (const target of targets) {
            const info = targetInfo(ns, target);
            ns.printf(baseFormatString, ...info);
        }
        await ns.sleep(flags.refreshrate);
    }
}

function targetInfo(ns: NS, host: string): (string | number)[] {
    const maxMoney = ns.getServerMaxMoney(host);
    const minSec = ns.getServerMinSecurityLevel(host);
    let money = ns.getServerMoneyAvailable(host);
    if (money === 0) money = 1;
    const sec = ns.getServerSecurityLevel(host);

    const moneyPercent = (money / maxMoney * 100).toFixed(2);
    const secPlus = (sec - minSec).toFixed(2);

    return [host, moneyPercent, secPlus, 0, 0, 0];
}
