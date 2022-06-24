import type { NS } from "netscript";

import { weakenAnalyze } from '../lib';

export async function main(ns: NS) {
    const hostsJSON = ns.args[0];
    if (typeof hostsJSON != 'string') {
        ns.printf('invalid hosts list');
        return;
    }
    const hosts: string[] = JSON.parse(hostsJSON);

    const targetsJSON = ns.args[1];
    if (typeof targetsJSON != 'string') {
        ns.printf('invalid targets list');
        return;
    }
    const targets: string[] = JSON.parse(targetsJSON);
    // Calculate initial weaken details for all targets (time, threads)
    const targetSpecs = targets.map(t => analyzeSoftenTarget(ns, t));

    // N.B. no rounds are used in this stage because it's faster to
    // just weaken it in one go, so we start all the threads at once.

    // Determine total number of threads available across all hosts

    // Order targets by increasing weaken time

    // Build a set of BatchSpecs for all hosts by greedily assigning threads
    // to initially weaken targets

    // Include a batch spec for starting the building phase
}

type TargetSpec = {
    host: string,
    threads: number,
    time: number,
};

function analyzeSoftenTarget(ns: NS, target: string): TargetSpec {
    const threads = weakenAnalyze(ns, target, 1.0);
    const time = ns.getWeakenTime(target);
    return {
        'host': target,
        'threads': threads,
        'time': time
    };
}
