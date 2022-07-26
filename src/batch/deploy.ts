import type { NS } from "netscript";

import { getRootAccess, exploitableHosts, usableHosts } from '../lib.js';
import { walkNetworkBFS } from "../walk-network.js";

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
