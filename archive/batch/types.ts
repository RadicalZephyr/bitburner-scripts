import type { NS } from "netscript";

export type ScriptArgs = string | number | boolean;

export type BatchScript = "/batch/grow.js" | "/batch/hack.js" | "/batch/weaken.js";

export class BatchInstance {
    pid: number;
    script: BatchScript;
    host: string;
    threads: number;
    target: string;

    constructor(
        pid: number,
        script: BatchScript,
        host: string,
        threads: number,
        target: string,
    ) {
        this.pid = pid;
        this.script = script;
        this.host = host;
        this.threads = threads;
        this.target = target;
    }
};

export class BatchSpec {
    target: string;
    script: BatchScript;
    threads: number;
    startTime: number;
    runTime: number;
    endDelay: number;
    loop: boolean;

    constructor(
        target: string,
        script: BatchScript,
        threads: number,
        startTime: number,
        runTime: number,
        endDelay: number,
        loop: boolean
    ) {
        this.target = target;
        this.script = script;
        this.threads = threads;
        this.startTime = startTime;
        this.runTime = runTime;
        this.endDelay = endDelay;
        this.loop = loop;
    }

    spawn(ns: NS, host: string, ...extraArgs: ScriptArgs[]): BatchInstance {
        if (this.threads > 0) {
            let args = [this.target, this.startTime, ...extraArgs];
            if (this.loop) args.unshift('--loop');

            const pid = ns.exec(this.script, host, this.threads, ...args);

            if (pid == 0) return null;

            return new BatchInstance(pid, this.script, host, this.threads, this.target);
        }
        return null;
    }
};
