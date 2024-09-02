import type { NS, ScriptArg } from "netscript";

export interface BatchScriptInstance {
    target: string;
    script: string;
    threads: number;
    startTime: number;
    endDelay: number;
    rounds: number;
};

export function spawnBatchScript(ns: NS, host: string, scriptInstance: BatchScriptInstance, ...extraArgs: ScriptArg[]) {
    const { script, threads, target, startTime, endDelay, rounds } = scriptInstance;
    if (threads > 0) {
        let args = [target, startTime, rounds, endDelay, ...extraArgs];

        return ns.exec(script, host, threads, ...args);
    }
    return null;
}
