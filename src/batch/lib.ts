import type { NS, ScriptArg } from "netscript";

export interface BatchScriptInstance {
    target: string;
    script: string;
    threads: number;
    startTime: number;
    runTime: number;
    endDelay: number;
    loop: boolean;
};

export function spawnBatchScript(ns: NS, host: string, scriptInstance: BatchScriptInstance, ...extraArgs: ScriptArg[]) {
    const { script, threads, target, startTime, endDelay } = scriptInstance;
    if (threads > 0) {
        let args = [target, startTime, endDelay, ...extraArgs];
        if (scriptInstance.loop) args.unshift('--loop');

        return ns.exec(script, host, threads, ...args);
    }
    return null;
}
