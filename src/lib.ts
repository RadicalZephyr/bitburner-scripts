import type { NS } from "netscript";

import { portOpeningPrograms } from "./constants";

/** Check if node is a valid target
 */
export function validTarget(ns: NS, node: any) {
    return typeof (node) == "string" && ns.serverExists(node);
}

/** Calculate the number of threads this script can be run with on this node.
 */
export function numThreads(ns: NS, node: string, hackScript: string, percentage?: number): number {
    percentage = percentage ? percentage : 1.0;
    let hackScriptRam = ns.getScriptRam(hackScript);
    let availableNodeRam = availableRam(ns, node);
    return Math.floor(availableNodeRam * percentage / hackScriptRam);
}

/** Determine total amount of RAM available for running scripts.
 */
function availableRam(ns: NS, node: string): number {
    return ns.getServerMaxRam(node) - ns.getServerUsedRam(node);
}

/** Print the cost breakdown of a server tier with `ram` memory.
 */
export function reportServerComplementCost(ns: NS, ram: number): void {
    let maxServers = ns.getPurchasedServerLimit();
    let serverCost = ns.getPurchasedServerCost(ram);
    let totalCost = maxServers * serverCost;
    ns.tprint("you can buy ", maxServers, " servers with ",
        formatGigaBytes(ram), " of RAM for $",
        formatMoney(serverCost), " per server ",
        "for a total of $", formatMoney(totalCost),
    );
}

/** Return the maximum amount of ram that can be purchased.
 */
export function getHighestPurchasableRamLevel(ns: NS, percentageSpend: number): number {
    let maxServers = ns.getPurchasedServerLimit();
    let maxServerTierSpend = ns.getServerMoneyAvailable("home") * percentageSpend;
    let maxPerServerSpend = maxServerTierSpend / maxServers;
    let maxServerRam = ns.getPurchasedServerMaxRam();

    let ram = 16;

    while (maxPerServerSpend > ns.getPurchasedServerCost(ram)) {
        ram *= 2;
    }

    return ram / 2;
}

export function formatMoney(value: number): string {
    var s = ['', 'k', 'm', 'b', 't', 'q'];
    var e = Math.floor(Math.log(value) / Math.log(1000));
    return (value / Math.pow(1000, e)).toFixed(2) + s[e];
}


export function formatGigaBytes(value: number): string {
    var s = ['GB', 'TB', 'PB'];
    var e = Math.floor(Math.log(value) / Math.log(1024));
    return (value / Math.pow(1024, e)).toFixed(0) + s[e];
}

/** Get root access to a server if possible.
 *
 * @returns whether you have root access to the target `host`.
 */
export function getRootAccess(ns: NS, host: string): boolean {
    if (!ns.hasRootAccess(host) && canNuke(ns, host)) {

        const portOpeningProgramFns = {
            "BruteSSH.exe": ns.brutessh,
            "FTPCrack.exe": ns.ftpcrack,
            "relaySMTP.exe": ns.relaysmtp,
            "HTTPWorm.exe": ns.httpworm,
            "SQLInject.exe": ns.sqlinject,

        };
        for (const program of portOpeningPrograms) {
            if (ns.fileExists(program)) {
                portOpeningProgramFns[program](host);
            }
        }
        ns.nuke(host);
    }
    return ns.hasRootAccess(host);
}

/** Check if we can hack this host.
 *
 * Note: hacking is different than nuking. Hacking
 * steals money from a server. Nuking only acquires
 * root access, and the hacking skill required is
 * _always_ 1.
 */
export function canHack(ns: NS, host: string): boolean {
    return ns.getHackingLevel() >= ns.getServerRequiredHackingLevel(host)
        && canNuke(ns, host);
}

/** Check if we can nuke this host.
 *
 * Note: hacking is different than nuking. Hacking
 * steals money from a server. Nuking only acquires
 * root access, and the hacking skill required is
 * _always_ 1.
 */
export function canNuke(ns: NS, host: string): boolean {
    if (ns.hasRootAccess(host)) { return true; }

    // Get number of open ports needed
    let portsNeeded = ns.getServerNumPortsRequired(host);

    // Check for existence of enough port opening programs
    let existingPrograms = portOpeningPrograms.filter(p => ns.fileExists(p));
    return existingPrograms.length >= portsNeeded;
}

/** Filter hosts by exploitability.
 */
export function preppableHosts(ns: NS, hosts: string[]): string[] {
    return hosts.filter((host) => {
        return ns.serverExists(host)
            && hasMoney(ns, host)
            && canNuke(ns, host);
    });
}

/** Filter hosts by exploitability.
 */
export function exploitableHosts(ns: NS, hosts: string[]): string[] {
    return hosts.filter((host) => {
        return ns.serverExists(host)
            && canHack(ns, host)
            && hasMoney(ns, host);
    });
}

/** Check if a host has a non-zero money capacity.
 */
function hasMoney(ns: NS, host: string): boolean {
    return ns.getServerMaxMoney(host) > 0;
}

/**
 *
 */
export function availableHosts(ns: NS, hosts: string[]): string[] {
    return hosts.filter((host) => {
        return availableRam(ns, host) > 0;
    });
}

/** Filter hosts by whether they can run scripts.
 */
export function usableHosts(ns: NS, hosts: string[]): string[] {
    return hosts.filter((host) => {
        return ns.serverExists(host)
            && canNuke(ns, host)
            && hasRam(ns, host);
    });
}

function hasRam(ns: NS, host: string): boolean {
    return ns.getServerMaxRam(host) > 0;
}

/** Calculate the number of threads needed to grow the server by a
 * certain multiplier.
 */
export function growAnalyze(ns: NS, target: string, growthAmount: number): number {
    if (growthAmount >= 1) {
        return Math.ceil(ns.growthAnalyze(target, growthAmount, 1));
    } else {
        return 0;
    }
}

/** Calculate the number of threads needed to hack the server for a
 * given multiplier.
 */
export function hackAnalyze(ns: NS, target: string, hackAmount: number): number {
    const oneThreadHackAmount = ns.hackAnalyze(target);
    return Math.ceil(hackAmount / oneThreadHackAmount);
}

/** Calculate the number of threads needed to weaken the `target` by
 * the given multiplier.
 */
export function weakenAnalyze(ns: NS, target: string, weakenAmount: number): number {
    const currentSecurity = ns.getServerSecurityLevel(target);
    const minSecurity = ns.getServerMinSecurityLevel(target);
    return weakenThreads((currentSecurity - minSecurity) * weakenAmount);
}

/** Calculate the number of threads to weaken any server by the given amount.
 */
export function weakenThreads(weakenAmount: number): number {
    // We multiply by 20 because 1 thread of weaken reduces security
    // by a fixed amount of 0.05, or 1/20
    return Math.ceil(weakenAmount * 20);
}

/*****************************************
 * Iterator Utilities
 *****************************************/

type Partition<T> = [isTrue: T[], isFalse: T[]];

export function partition<T>(arr: T[], pred: ((t: T) => boolean)): Partition<T> {
    let part: Partition<T> = [[], []];
    return arr.reduce((part, t) => {
        if (pred(t)) {
            part[0].push(t);
        } else {
            part[1].push(t);
        }
        return part;
    }, part);
}

type BatchOptions = [
    host: string,
    target: string,
];

/*****************************************
 * Batch hacking utilities
 *****************************************/

export function singleTargetBatchOptions(ns: NS): BatchOptions {
    const host = ns.args[0];
    if (typeof host != 'string' || !ns.serverExists(host)) {
        ns.tprintf('invalid host');
        ns.exit();
        return ['', ''];
    }

    const target = ns.args[1];
    if (typeof target != 'string' || !ns.serverExists(target)) {
        ns.tprintf('invalid target');
        ns.exit();
        return ['', ''];
    }

    return [
        host,
        target
    ];
}


export type BatchScriptInstance = {
    script: string;
    threads: number;
    host: string;
    target: string;
    startTime: number;
    runTime: number;
};

export function spawnBatchScript(ns: NS, scriptInstance: BatchScriptInstance) {
    const { script, threads, host, target, startTime } = scriptInstance;
    if (threads > 0) {
        ns.exec(script, host, threads, target, startTime);
    }
}

export type BatchScript = "/batch/grow.js" | "/batch/hack.js" | "/batch/weaken.js";

export class BatchInstance {
    pid: number;
    script: BatchScript;
    host: string;
    threads: number;
    target: string;
    delay: number;

    constructor(
        pid: number,
        script: BatchScript,
        host: string,
        threads: number,
        target: string,
        delay: number,
    ) {
        this.pid = pid;
        this.script = script;
        this.host = host;
        this.threads = threads;
        this.target = target;
        this.delay = delay;
    }
};

export class BatchSpec {
    script: BatchScript;
    host: string;
    threads: number;
    target: string;
    delay: number;

    constructor(
        script: BatchScript,
        host: string,
        threads: number,
        target: string,
        delay: number,
    ) {
        this.script = script;
        this.host = host;
        this.threads = threads;
        this.target = target;
        this.delay = delay;
    }

    exec(ns: NS): BatchInstance {
        if (this.threads >= 1) {
            const pid = ns.exec(this.script, this.host, this.threads, this.target, this.delay);

            if (pid == 0) return null;

            return new BatchInstance(pid, this.script, this.host, this.threads, this.target, this.delay);
        }
        return null;
    }
};

/*****************************************
 * Heap Implementation
 *****************************************/
type Entry<T> = {
    key: number,
    value: T,
}

export class Heap<T> {
    data: Entry<T>[];
    keyFn: ((v: T) => number);

    constructor(values: T[], keyFn: ((v: T) => number)) {
        let data = values.map(v => { return { key: keyFn(v), value: v }; });
        buildMinHeap(data);
        this.data = data;
        this.keyFn = keyFn;
    }

    length(): number {
        return this.data.length;
    }

    pop(): T {
        if (this.data.length > 1) {
            const min = this.data[0].value;
            let last = this.data.pop();
            this.data[0] = last;
            minHeapify(this.data, 0);
            return min;
        } else if (this.data.length == 1) {
            return this.data.pop().value;
        }
    }

    min(): T {
        if (this.data.length > 0) {
            return this.data[0].value;
        }
    }

    updateMinKey() {
        if (this.data.length <= 0) return;

        let min = this.data[0];
        min.key = this.keyFn(min.value);
        minHeapify(this.data, 0);
    }
}

function buildMinHeap<T>(A: Entry<T>[]) {
    const last = A.length - 1;
    for (let i = parent(last); i >= 0; --i) {
        minHeapify(A, i);
    }

}

function minHeapify<T>(A: Entry<T>[], i: number) {
    const l = left(i);
    const r = right(i);

    let smallest;
    if (l < A.length && A[l].key < A[i].key) {
        smallest = l;
    } else {
        smallest = i;
    }

    if (r < A.length && A[r].key < A[smallest].key) {
        smallest = r;
    }

    if (smallest != i) {
        const temp = A[i];
        A[i] = A[smallest];
        A[smallest] = temp;
        minHeapify(A, smallest);
    }
}

function parent(index: number) {
    return Math.floor((index - 1) / 2);
}

function left(index: number) {
    return 2 * index + 1;
}

function right(index: number) {
    return 2 * index + 2;
}
