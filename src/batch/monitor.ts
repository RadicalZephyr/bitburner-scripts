import type { NS } from "netscript";

import {
    TargetThreads,
    buildingHosts,
    byHackLevel,
    countThreadsByTarget,
    getAllHosts,
    milkingHosts,
    moneyPercentage,
    readyToBuildHosts,
    readyToMilkHosts,
    readyToSoftenHosts,
    softeningHosts
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
        const maxTargetNameLen = Math.max(...allHosts.map(t => t.length));

        const allTargetThreads = countThreadsByTarget(ns, allHosts);

        let readyToSoftenTargets = readyToSoftenHosts(ns, allTargetThreads, allHosts);
        readyToSoftenTargets.sort(byHackLevel(ns));

        let softeningTargets = softeningHosts(ns, allTargetThreads, allHosts);
        softeningTargets.sort(byHackLevel(ns));

        let readyToBuildTargets = readyToBuildHosts(ns, allTargetThreads, allHosts);
        readyToBuildTargets.sort(byHackLevel(ns));

        let buildingTargets = buildingHosts(ns, allTargetThreads, allHosts);
        buildingTargets.sort(byHackLevel(ns));

        let readyToMilkTargets = readyToMilkHosts(ns, allTargetThreads, allHosts);
        readyToMilkTargets.sort(byHackLevel(ns));

        let milkingTargets = milkingHosts(ns, allTargetThreads, allHosts);
        milkingTargets.sort(byHackLevel(ns));

        type TargetCategories = [
            category: string,
            targets: string[]
        ];
        const targetCategories: TargetCategories[] = [
            ["Ready To Soften", readyToSoftenTargets],
            ["Softening", softeningTargets],
            ["Ready To Build", readyToBuildTargets],
            ["Building", buildingTargets],
            ["Ready To Milk", readyToMilkTargets],
            ["Milking", milkingTargets]
        ];

        for (const [category, targets] of targetCategories) {
            if (targets.length == 0) continue;

            const baseFormatString = ` %${maxTargetNameLen}s  |  %7s  %7s  %7s  %7s  %7s  %8s`;
            const headings = ['target', '⌈$⌉%', '+sec', 'thr(h)', 'thr(g)', 'thr(w)', '$/thr(h)'];

            const dividerFormatString = baseFormatString.replaceAll(' ', '-').replaceAll('%', "%'-");

            const blanks = Array(headings.length).fill('');

            ns.printf('\n%s Targets:', category);
            ns.printf(baseFormatString, ...headings);
            ns.printf(dividerFormatString, ...blanks);
            for (const target of targets) {
                const info = targetInfo(ns, target, allTargetThreads.get(target));
                ns.printf(baseFormatString, ...info);
            }
        }
        await ns.sleep(flags.refreshrate);
    }
}

function targetInfo(ns: NS, target: string, targetThreads: TargetThreads): (string | number)[] {
    const minSec = ns.getServerMinSecurityLevel(target);
    const sec = ns.getServerSecurityLevel(target);

    const moneyPercent = moneyPercentage(ns, target) * 100;
    const secPlus = sec - minSec;

    return [
        target,
        Math.abs(moneyPercent - 100) < 0.001 ? '100%' : ns.nFormat(moneyPercent / 100, '0.00%'),
        Math.abs(secPlus) < 0.1 ? '+0.0' : ns.nFormat(secPlus, '+0.00a'),
        Math.abs(targetThreads.h) < 1 ? '' : ns.nFormat(targetThreads.h, '0.00a'),
        Math.abs(targetThreads.g) < 1 ? '' : ns.nFormat(targetThreads.g, '0.00a'),
        Math.abs(targetThreads.w) < 1 ? '' : ns.nFormat(targetThreads.w, '0.00a'),
        Math.abs(targetThreads.hAvgMoney) < 1 ? '' : ns.nFormat(targetThreads.hAvgMoney, '$0.00a')
    ];
}
