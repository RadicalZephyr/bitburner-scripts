import type { NS, ScriptArg } from "netscript";

export type Pid = {
    pid: number,
    threads: number
};

export interface BatchScriptInstance {
    targetName: string;
    script: string;
    threads: number;
    startTime: number;
    endDelay: number;
    rounds: number;

    pids: Pid[];

    needsMoreThreads(): boolean;
    runningThreads(): number;
};

export function spawnBatchScript(ns: NS, host: string, scriptInstance: BatchScriptInstance, ...extraArgs: ScriptArg[]) {
    const { script, threads, targetName, startTime, endDelay, rounds } = scriptInstance;
    if (threads > 0) {
        let args = [targetName, startTime, rounds, endDelay, ...extraArgs];

        return ns.exec(script, host, threads, ...args);
    }
    return null;
}
