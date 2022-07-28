import type { NS } from "netscript";

import { getRootAccess, exploitableHosts, usableHosts, walkNetworkBFS } from '../lib';

const scripts = {
    'grow': '/batch/grow.js',
    'hack': '/batch/hack.js',
    'weaken': '/batch/weaken.js'
};
const scriptList = [scripts.grow, scripts.hack, scripts.weaken];

export async function main(ns: NS) {
    let network = walkNetworkBFS(ns);
    let allHosts = Array.from(network.keys());

    let hosts = usableHosts(ns, allHosts);
    let targets = exploitableHosts(ns, allHosts);

    ns.tprintf(
        "hosts (%d): [%s]\ntargets (%d): [%s]\n",
        hosts.length, hosts.join(", "),
        targets.length, targets.join(", ")
    );

    // Deploy all batch scripts to all host servers
    for (const host of hosts) {
        getRootAccess(ns, host);
        await ns.scp(scriptList, host);
    }

    for (const target of targets) {
        getRootAccess(ns, target);
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
// to notice when the purchased servers get upgrade because a bunch of
// threads will get killed, and that will kill a completely unknown
// amount of batches. In order to fill a round again, we really need
// to kill the rest of the batches in that round and just restart
// them.
