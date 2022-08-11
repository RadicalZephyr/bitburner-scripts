import type { NS } from "netscript";

import {
    Heap,
    byLvlAndMoney,
    calculateWeakenInstance,
    countThreadsByTarget,
    getAllHosts,
    getRootAccess,
    inverseAvailableRam,
    milkingHosts,
    readyToBuildHosts,
    readyToMilkHosts,
    readyToSoftenHosts,
    spawnBatchScript,
    targetableHosts,
    usableHosts
} from '../lib';

const scriptList = ['/batch/grow.js', '/batch/hack.js', '/batch/weaken.js'];

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

    while (true) {
        const allHosts = getAllHosts(ns);
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

        readyToSoftenTargets.sort(byLvlAndMoneyDesc);

        for (const sTarget of readyToSoftenTargets) {
            let weakenInstance = calculateWeakenInstance(ns, sTarget);

            let host = hostsHeap.min();
            ns.print(`softening ${sTarget} with ${weakenInstance.threads} threads on ${host}`);

            const pid = spawnBatchScript(ns, host, weakenInstance);
            if (pid !== 0) {
                softeningTargets.push({ pid, weakenInstance });
            }
            await ns.sleep(150);
            hostsHeap.updateMinKey();
        }

        let milkingTargets = milkingHosts(ns, allTargetThreads, allHosts);
        let readyToMilkTargets = readyToMilkHosts(ns, allTargetThreads, allHosts);

        if (milkingTargets.length < options.milkMax) {
            readyToMilkTargets.sort(byLvlAndMoneyDesc);

            const numNewMilkTargets = options.milkMax - milkingTargets.length;
            for (const mTarget of readyToMilkTargets.slice(0, numNewMilkTargets)) {
                ns.run('/batch/milk.js', 1, mTarget);
            }
        } else { }

        let readyToBuildTargets = readyToBuildHosts(ns, allTargetThreads, allHosts);
        readyToBuildTargets.sort(byLvlAndMoneyDesc);

        for (const bTarget of readyToBuildTargets) {
            ns.run('/batch/build.js', 1, bTarget);
        }

        await ns.sleep(options.refreshrate);
    }
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
