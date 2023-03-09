import type { NS } from "netscript";

import {
    TargetThreads,
    buildingHosts,
    byLvlAndMoney,
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

    if (flags.help || typeof flags.refreshrate != 'number') {
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
    ns.disableLog('ALL');
    ns.clearLog();
    ns.tail();
    ns.moveTail(250, 75);
    ns.resizeTail(1050, 400);

    while (true) {
        ns.clearLog();

        const allHosts = getAllHosts(ns);
        const maxTargetNameLen = Math.max(...allHosts.map(t => t.length));

        const allTargetThreads = countThreadsByTarget(ns, allHosts);

        let readyToSoftenTargets = readyToSoftenHosts(ns, allTargetThreads, allHosts);
        readyToSoftenTargets.sort(byLvlAndMoney(ns));

        let softeningTargets = softeningHosts(ns, allTargetThreads, allHosts);
        softeningTargets.sort(byLvlAndMoney(ns));

        let readyToBuildTargets = readyToBuildHosts(ns, allTargetThreads, allHosts);
        readyToBuildTargets.sort(byLvlAndMoney(ns));

        let buildingTargets = buildingHosts(ns, allTargetThreads, allHosts);
        buildingTargets.sort(byLvlAndMoney(ns));

        let readyToMilkTargets = readyToMilkHosts(ns, allTargetThreads, allHosts);
        readyToMilkTargets.sort(byLvlAndMoney(ns));

        let milkingTargets = milkingHosts(ns, allTargetThreads, allHosts);
        milkingTargets.sort(byLvlAndMoney(ns));

        type TargetCategories = [
            category: string,
            targets: string[]
        ];
        const targetCategories: TargetCategories[] = [
            ["Milking", milkingTargets],
            ["Ready To Milk", readyToMilkTargets],
            ["Building", buildingTargets],
            ["Ready To Build", readyToBuildTargets],
            ["Softening", softeningTargets],
            ["Ready To Soften", readyToSoftenTargets]
        ];

        for (const [category, targets] of targetCategories) {
            if (targets.length == 0) continue;

            const baseFormatString = ` %${maxTargetNameLen}s  |  %8s  %9s  %5s  %8s  %7s  %7s  %7s  %7s  %7s`;
            const headings = ['target', '$/s', '$/lvl', 'lvl', '$', '⌈$⌉%', '+sec', 'thr(h)', 'thr(g)', 'thr(w)'];

            const dividerFormatString = baseFormatString.replaceAll(' ', '-').replaceAll('%', "%'-");

            const blanks = Array(headings.length).fill('');

            ns.printf('\n%s Targets:', category);
            ns.printf(targets.join(' '));
            ns.printf(baseFormatString, ...headings);
            ns.printf(dividerFormatString, ...blanks);

            let totalMoney = 0;
            for (const target of targets) {
                const targetThreads = allTargetThreads.get(target);
                totalMoney += targetThreads.mMoney;
                const info = targetInfo(ns, target, targetThreads);
                ns.printf(baseFormatString, ...info);
            }

            if (totalMoney > 0) {
                ns.printf(baseFormatString, 'Total Income:', ns.nFormat(totalMoney, '$0.0a'), ...blanks);
            }
        }
        await ns.sleep(flags.refreshrate);
    }
}

function targetInfo(ns: NS, target: string, targetThreads: TargetThreads): (string | number)[] {
    const hackLvl = ns.getServerRequiredHackingLevel(target);
    const minSec = ns.getServerMinSecurityLevel(target);
    const sec = ns.getServerSecurityLevel(target);

    const money = ns.getServerMaxMoney(target);
    const moneyPercent = moneyPercentage(ns, target) * 100;
    const secPlus = sec - minSec;

    const milkMoney = targetThreads.mMoney;

    return [
        target,
        Math.abs(milkMoney) < 0 ? '' : ns.nFormat(milkMoney, '$0.00a'),
        ns.nFormat(money / hackLvl, '$0.00a'),
        ns.nFormat(hackLvl, '0,0'),
        ns.nFormat(money, '$0.00a'),
        Math.abs(moneyPercent - 100) < 0.1 ? '100.0%' : ns.nFormat(moneyPercent / 100, '0.00%'),
        Math.abs(secPlus) < 0.1 ? '+0.0' : ns.nFormat(secPlus, '+0.00a'),
        formatThreads(ns, targetThreads.h),
        formatThreads(ns, targetThreads.g),
        formatThreads(ns, targetThreads.w)
    ];
}

function formatThreads(ns: NS, threads: number): string {
    if (threads < 1) {
        return '';
    }

    let fmt = '0.00a';
    if (threads < 1000) {
        fmt = '0';
    }
    return ns.nFormat(threads, fmt);
}
