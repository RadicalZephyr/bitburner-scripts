import type { NS } from "netscript";

import {
    TargetThreads,
    buildableHosts,
    byHackLevel,
    countThreadsByTarget,
    getAllHosts,
    milkableHosts,
    moneyPercentage,
    softenableHosts
} from '../lib';

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

    while (true) {
        ns.clearLog();

        const allHosts = getAllHosts(ns);
        const targetThreads = countThreadsByTarget(ns, allHosts);

        let softenTargets = softenableHosts(ns, allHosts);
        softenTargets.sort(byHackLevel(ns));

        let buildTargets = buildableHosts(ns, allHosts);
        buildTargets.sort(byHackLevel(ns));

        let milkTargets = milkableHosts(ns, allHosts);
        milkTargets.sort(byHackLevel(ns));

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

function targetInfo(ns: NS, target: string, targetThreads: TargetThreads): (string | number)[] {
    const minSec = ns.getServerMinSecurityLevel(target);
    const sec = ns.getServerSecurityLevel(target);

    const moneyPercent = (moneyPercentage(ns, target) * 100).toFixed(2);
    const secPlus = (sec - minSec).toFixed(2);

    return [target, moneyPercent, secPlus, targetThreads.h, targetThreads.g, targetThreads.w];
}
