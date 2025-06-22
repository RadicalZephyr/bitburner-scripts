import type { NS, ScriptArg } from "netscript";

import type { Worker } from "batch/worker";

export type Pid = {
    pid: number,
    threads: number
};

export interface BatchScriptInstance {
    targetName: string;
    script: string;
    scriptRam: number;
    threads: number;
    startTime: number;
    endDelay: number;
    rounds: number;

    pids: Pid[];

    needsMoreThreads(): boolean;
    neededThreads(): number;
    pushPid(pid: Pid);
};

export function spawnBatchScript(ns: NS, host: string, threads: number, scriptInstance: BatchScriptInstance, ...extraArgs: ScriptArg[]) {
    const { script, targetName, startTime, endDelay, rounds } = scriptInstance;
    if (threads > 0) {
        let args = [targetName, startTime, rounds, endDelay, ...extraArgs];

        let pid = ns.exec(script, host, threads, ...args);
        if (pid !== 0) {
            return {
                pid,
                threads,
            };
        } else {
            return undefined;
        }
    }
    return null;
}

/** Calculate the number of threads this script can be run with on this node.
 */
export function maxThreadsOnWorker(ns: NS, worker: Worker, scriptInstance: BatchScriptInstance): number {
    let scriptRam = scriptInstance.scriptRam;
    let availableNodeRam = worker.availableRam();
    return Math.min(Math.floor(availableNodeRam / scriptRam), scriptInstance.neededThreads());
}

/** Spawn as many threads of a script instance on a Worker as possible.
 */
export function spawnScriptOnWorker(ns: NS, worker: Worker, scriptInstance: BatchScriptInstance) {
    let availableRam = worker.availableRam();
    let threads = maxThreadsOnWorker(ns, worker, scriptInstance);

    let pid = spawnBatchScript(ns, worker.name, threads, scriptInstance);
    scriptInstance.pushPid(pid);
}
