import type { NS } from "netscript";

import {
    Heap,
    TargetThreads,
    byLvlAndMoney,
    calculateWeakenInstance,
    countThreadsByTarget,
    getAllHosts,
    getRootAccess,
    inverseAvailableRam,
    milkingHosts,
    moneyPercentage,
    readyToBuildHosts,
    readyToMilkHosts,
    readyToSoftenHosts,
    spawnBatchScript,
    targetableHosts,
    usableHosts
} from '../lib';

const scriptList = ['/batch/grow.js', '/batch/hack.js', '/batch/weaken.js'];

type TargetCategories = [
    category: string,
    targets: string[]
];

export async function main(ns: NS) {
    const options = ns.flags([
        ['milkMax', 8],
        ['refreshrate', 500],
        ['help', false],
    ]);

    if (options.help) {
        ns.tprint(`
Manage identifying what stage of the batch hacking lifecycle targets
are in and spawning appropriate scripts to progress them through it.

USAGE: run ${ns.getScriptName()}

OPTIONS:
  --milkMax      Maximum number of hosts to milk at one time
  --refreshrate  Time to wait between refreshing target status in milliseconds
  --help         Show this help message.
`);
        return;
    }

    const byLvlAndMoneyDesc = byLvlAndMoney(ns);

    let softeningTargets = [];

    ns.disableLog('ALL');
    ns.clearLog();
    ns.tail();

    while (true) {
        const allHosts = getAllHosts(ns);
        const maxTargetNameLen = Math.max(...allHosts.map(t => t.length));
        const allTargetThreads = countThreadsByTarget(ns, allHosts);

        const hosts = usableHosts(ns, allHosts);
        let targets = targetableHosts(ns, allHosts);
        targets.sort(byLvlAndMoneyDesc);

        // Deploy all batch scripts to all host servers
        for (const host of hosts) {
            getRootAccess(ns, host);
            await ns.scp(scriptList, host);
        }

        for (const target of targets) {
            getRootAccess(ns, target);
            await ns.sleep(50);
        }

        let hostsHeap = new Heap(hosts, host => inverseAvailableRam(ns, host));

        let readyToSoftenTargets = readyToSoftenHosts(ns, allTargetThreads, allHosts);

        // Get current running soften target script info
        let stillSofteningTargets = softeningTargets
            .map(({ pid, weakenInstance }) => {
                return {
                    pid,
                    weakenInstance,
                    scriptInfo: ns.getRunningScript(pid)
                };
            })
            // filter for the scripts that are still running
            .filter(sI => sI.scriptInfo);

        for (const sInstance of stillSofteningTargets) {
            // Calculate how much time remains for the current instance
            const elapsedTime = sInstance.scriptInfo.onlineRunningTime;
            const remainingTime = sInstance.weakenInstance.runTime - elapsedTime;

            // Calculate the running time of a soften script launched now
            const sTarget = sInstance.weakenInstance.target;
            let currentWeakenInstance = calculateWeakenInstance(ns, sTarget);

            // If restarting would be at least 25% faster, then restart.
            // We use a large margin to avoid restarting scripts too often
            if (currentWeakenInstance.runTime < remainingTime * 0.75) {
                if (ns.kill(sInstance.pid)) readyToSoftenTargets.push(sTarget);
            }
            await ns.sleep(50);
        }

        if (readyToSoftenTargets.length > 0) {
            readyToSoftenTargets.sort(byLvlAndMoneyDesc);

            for (const sTarget of readyToSoftenTargets) {
                let weakenInstance = calculateWeakenInstance(ns, sTarget);

                let host = hostsHeap.min();
                ns.print(`softening ${sTarget} with ${weakenInstance.threads} threads on ${host}`);

                const pid = spawnBatchScript(ns, host, weakenInstance);
                if (pid !== 0) {
                    softeningTargets.push({ host, pid, weakenInstance });
                }
                await ns.sleep(150);
                hostsHeap.updateMinKey();
            }
        }

        let milkingTargets = augmentWithRipenessMetric(ns, milkingHosts(ns, allTargetThreads, allHosts));
        let readyToMilkTargets = augmentWithRipenessMetric(ns, readyToMilkHosts(ns, allTargetThreads, allHosts));
        readyToMilkTargets.sort(byRipenessDesc);

        if (milkingTargets.length < options.milkMax) {
            const numNewMilkTargets = options.milkMax - milkingTargets.length;
            for (const mTarget of readyToMilkTargets.slice(0, numNewMilkTargets)) {
                ns.run('/batch/milk.js', 1, mTarget.host);
            }
        } else {
            // If we're at maximum capacity for milking, then replace
            // current milking targets with higher value ones.

            // Sort milking targets in ascending order, opposite of
            // the ready to milk targets.
            milkingTargets.sort(byRipenessAsc);

            const totalCanSwap = Math.min(milkingTargets.length, readyToMilkTargets.length);

            for (let i = 0; i < totalCanSwap; ++i) {
                const current = milkingTargets[i];
                const prospect = readyToMilkTargets[i];

                // Because these arrays are sorted in opposing order,
                // once we see a pair where the worst current milking
                // target is better than the best ready to milk
                // target, we can stop replacing.
                if (current.ripeness >= prospect.ripeness) break;

                // Otherwise, if the prospect is better, then halt the
                // current target and milk the prospective one.
                ns.run('/batch/halt.js', 1, current.host);
                ns.run('/batch/milk.js', 1, prospect.host);
                await ns.sleep(10);
            }
        }

        let readyToBuildTargets = readyToBuildHosts(ns, allTargetThreads, allHosts);

        let buildingTargets = [];
        if (readyToBuildTargets.length > 0) {
            readyToBuildTargets.sort(byLvlAndMoneyDesc);

            for (const bTarget of readyToBuildTargets) {
                ns.run('/batch/build.js', 1, bTarget);
                buildingTargets.push(bTarget);
                await ns.sleep(10);
            }
        }

        ns.clearLog();

        const targetCategories: TargetCategories[] = [
            ["Milking", stripRipeness(ns, milkingTargets)],
            ["Ready To Milk", stripRipeness(ns, readyToMilkTargets)],
            ["Building", buildingTargets],
            ["Ready To Build", readyToBuildTargets],
            ["Softening", softeningTargets.map(softenTarget => softenTarget.host)],
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

        await ns.sleep(options.refreshrate);
    }
}

type RipeHost = {
    host: string,
    ripeness: number,
};

function augmentWithRipenessMetric(ns: NS, hosts: string[]): RipeHost[] {
    return hosts.map(host => {
        let ripeness = ns.getServerMaxMoney(host) / ns.getServerRequiredHackingLevel(host);
        return { host, ripeness };
    });
}

function stripRipeness(ns: NS, ripeHosts: RipeHost[]): string[] {
    return ripeHosts.map(ripeHost => {
        return ripeHost.host;
    })
}

const byRipenessAsc = ((a: RipeHost, b: RipeHost) => {
    return a.ripeness - b.ripeness;
});

const byRipenessDesc = ((a: RipeHost, b: RipeHost) => byRipenessAsc(b, a));


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

// Notes on how I'm using the single target scripts.

// In general, softening doesn't take very many threads, so we should
// basically do it as soon as we possibly can for each server.

// Building is harder, and for every server larger than n00dles, we
// need a _lot_ of RAM to completely build in one batch. This probably
// means that we should only build one server at a time.

// Minimal milking batches are pretty small, but because of how long
// it takes to do a weaken (until we get to really high hacking
// levels), it's hard to fill up an entire round of batches because of
// how many batches ought to be launched in parallel.

// This again means that until we have a lot of RAM we should settle
// for longer delays between starting each script in a batch.

////////////////////////////////////////

// Another interesting thing I just noticed is that it's actually more
// time efficient to wait to soften higher level targets until our
// hacking skill is higher.

// After my last augment installation, I started the medium augmenting
// scripts by softening all that are ready. Only foodnstuff finished
// before building n00dles finished and my hacking skill jumped
// significantly. Even waiting several more minutes, when I looked at
// the rest of the original targets that were being softened, all of
// them had more time remaining on their original weaken script than
// they would if they were killed and restarted with my current
// hacking level.

// Now, this effect is probably exacerbated by my late node increases
// to hacking skill and level gain. But we want this script to work
// for all levels of play (or at least many). So it seems there is a
// need for a heuristic that tracks how long a particular weaken
// instance has left to run and then calculates how long it would take
// to restart the weaken script with the current hacking level. If
// restarting would take less time, then that script should be killed
// and restarted.

// The only tricky part of this is how does the management script
// track how long a particular instance is going to run for?

// I think the answer to this is that softening shouldn't be handled
// by an external launcher script since it doesn't need to be done in
// batches. Thus the manager script can just store the expected run
// time and the pid of the launched process, and compare the current
// run time with the expected run time against the expected runtime of
// a newly calculated script.

////////////////////////////////////////

// I'm on the fence currently about whether the build phase should be
// directly supervised by the launcher script. One way to make this
// moot, would be to add an option to the relevant grow and weaken
// scripts to allow the launcher to specify a specific number of
// iterations. This shouldn't increase the RAM cost at all because it
// won't use any new Netscript APIs and it would mean that the build
// phase is fire and forget, and not subject to other phases spawning
// threads into RAM that it was previously using between when one
// round ends and another begins.

////////////////////////////////////////

// Another interesting note is that I think the management script
// almost certainly should not handle launching the milking
// batches. For those it is actually fairly important to have the
// relative timing roughly accurate and so trying to combine launching
// batches against several different targets would introduce a lot of
// variable lag time for the individual netscript operations time.

// Also, once we launch the management script, it will sequentially
// spin up each batch, and we can easily launch these batches in
// parallel with parallel round starting scripts.


////////////////////////////////////////

// Finally, to make the manager script really robust, we probably need
// to notice when the purchased servers get upgraded because a bunch of
// threads will get killed, and that will kill a completely unknown
// amount of batches. In order to fill a round again, we really need
// to kill the rest of the batches in that round and just restart
// them.

////////////////////////////////////////

// There's also an issue with the length of a round changing over time
// as our hacking level increases. I think this is basically why the
// wiki shows those scripts as not having any looping, because
// essentially every round there is the potential for our hacking
// level to change so much that the round loop time will shrink and
// then the batches will be sort of arbitrarily overlapping in
// unmanaged ways. Also, the various wait times are probably just
// getting totally fucked.
