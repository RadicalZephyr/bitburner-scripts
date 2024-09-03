import type { NS } from "netscript";

import type { Target } from "batch/types";

import type { BatchScriptInstance } from "batch/lib";

type SoftenPid = {
    pid: number,
    target: string,
};

const softenScript = "/batch/w.js";

export class WeakenInstance implements BatchScriptInstance {
    ns: NS;
    _target: Target;
    script: string;
    scriptRam: number;

    threads: number;
    startTime: number;
    endDelay: number;
    rounds: number;

    hckLevel: number;
    runTime: number;

    pids: SoftenPid[];

    get target() {
        return this._target.name;
    }

    constructor(ns: NS, target: Target) {
        this.ns = ns;
        this._target = target;
        this.script = softenScript;
        this.scriptRam = ns.getScriptRam(softenScript);

        this.threads = softenAnalyze(ns, target.name);
        this.startTime = 0;
        this.endDelay = 0;
        this.rounds = 1;

        this.hckLevel = ns.getHackingLevel();
        this.runTime = ns.getWeakenTime(target.name);

        this.pids = [];
    }
}

/** Calculate the number of threads needed to soften the `target` by
 * the given multiplier.
 */
export function softenAnalyze(ns: NS, target: string, softenAmount?: number): number {
    const _softenAmount = typeof softenAmount == "number" ? softenAmount : 1;
    const currentSecurity = ns.getServerSecurityLevel(target);
    const minSecurity = ns.getServerMinSecurityLevel(target);
    return softenThreads((currentSecurity - minSecurity) * _softenAmount);
}

/** Calculate the number of threads to soften any server by the given amount.
 */
export function softenThreads(softenAmount: number): number {
    // We multiply by 20 because 1 thread of weaken reduces security
    // by a fixed amount of 0.05, or 1/20
    return Math.ceil(softenAmount * 20);
}
