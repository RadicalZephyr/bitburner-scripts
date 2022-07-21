import type { NS } from "netscript";

import { exploitableHosts, numThreads, usableHosts, weakenAnalyze } from '../lib';
import { walkNetworkBFS } from "../walk-network.js";

// import { analyzeSoftenTarget, WeakenInstance, WeakenSpec } from './soften';

const weakenScript = '/batch/weaken.js';

export type WeakenInstance = {
    host: string,
    pid: number,
    threads: number,
};

export type WeakenSpec = {
    host: string,
    threads: number,
    time: number,
};

export function analyzeSoftenTarget(ns: NS, target: string): WeakenSpec {
    const threads = weakenAnalyze(ns, target, 1.0);
    const time = ns.getWeakenTime(target);
    return {
        'host': target,
        'threads': threads,
        'time': time
    };
}

export async function main(ns: NS) {
    let network = walkNetworkBFS(ns);
    let allHosts = Array.from(network.keys());

    const hosts = usableHosts(ns, allHosts);
    const targets = exploitableHosts(ns, allHosts);

    // Calculate initial weaken details for all targets (time, threads)
    let targetSpecs = targets.map(t => analyzeSoftenTarget(ns, t));

    // Order targets by increasing weaken time
    targetSpecs.sort(byTime);

    ns.print('target weaken times:');
    targetSpecs.forEach(t => ns.print(`${t.host}: ${t.time}`));

    ns.print(`hosts: ${typeof hosts} = ${JSON.stringify(hosts)}`);
    ns.print(`targets: ${typeof targets} = ${JSON.stringify(targets)}`);

    // N.B. no rounds are used in this stage because it's faster to
    // just weaken it in one go, so we start all the threads at once.
    const waitTime = 0;

    let weakenInstances: WeakenInstance[] = [];
    let targetIndex = 0;

    ns.print(`available threads`);
    for (const host of hosts) {
        let weakenThreads = numThreads(ns, host, weakenScript);
        ns.print(`${host}: ${weakenThreads}`);

        if (weakenThreads === 0) continue;
        if (targetIndex >= targetSpecs.length) break;

        let nextTarget = targetSpecs[targetIndex];
        while (targetIndex < targetSpecs.length && weakenThreads > nextTarget.threads && nextTarget.threads > 0) {

            const threadsToRun = nextTarget.threads;

            const pid = ns.exec(weakenScript, host, threadsToRun, nextTarget.host, waitTime);

            if (pid !== 0) {
                ns.tprint(`spawned ${weakenScript} with ${threadsToRun} threads on ${host}`);
                weakenInstances.push({
                    'host': host,
                    'pid': pid,
                    'threads': threadsToRun
                });
                // Deduct just spawned threads from current host's available count
                weakenThreads -= threadsToRun;
            } else {
                ns.tprint(`failed to spawn ${weakenScript} with ${threadsToRun} threads on ${host}`);
            }

            targetIndex += 1;
            nextTarget = targetSpecs[targetIndex];
        }

        const threadsToRun = weakenThreads;

        const pid = ns.exec(weakenScript, host, threadsToRun, nextTarget.host, waitTime);

        if (pid !== 0) {
            ns.tprint(`spawned ${weakenScript} with ${threadsToRun} threads on ${host}`);
            weakenInstances.push({
                'host': host,
                'pid': pid,
                'threads': threadsToRun
            });
            // Deduct just spawned threads from current target's desired threads
            nextTarget.threads -= threadsToRun;

            if (nextTarget.threads === 0) targetIndex += 1;
        } else {
            ns.tprint(`failed to spawn ${weakenScript} with ${threadsToRun} threads on ${host}`);
        }
    }

    if (targetIndex >= targetSpecs.length) {
        ns.tprint('launched all weaken threads for softening phase');
    } else {
        const remainingTargets = targetSpecs.slice(targetIndex);
        const totalThreads = remainingTargets.reduce((acc, t) => acc + t.threads, 0);
        ns.tprint(`ran out of hosts to run weaken on, still need to launch ${totalThreads} threads targeting ${remainingTargets.length} hosts`);
    }
}

const byTime = (a: WeakenSpec, b: WeakenSpec) => a.time - b.time;
