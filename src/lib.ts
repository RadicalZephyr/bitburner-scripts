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
export function availableRam(ns: NS, node: string): number {
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

/** Filter for hosts that are ready to be softened.
 */
export function softenableHosts(ns: NS, hosts: string[]): string[] {
    return hosts.filter((host) => {
        return ns.serverExists(host)
            && hasMoney(ns, host)
            && canNuke(ns, host)
            && readyToSoften(ns, host);
    });
}

/** Filter for hosts that are ready to be built.
 */
export function buildableHosts(ns: NS, hosts: string[]): string[] {
    return hosts.filter((host) => {
        return ns.serverExists(host)
            && hasMoney(ns, host)
            && canNuke(ns, host)
            && readyToBuild(ns, host);
    });
}

/** Filter for hosts that are ready to be milked.
 */
export function milkableHosts(ns: NS, hosts: string[]): string[] {
    return hosts.filter((host) => {
        return ns.serverExists(host)
            && hasMoney(ns, host)
            && canHack(ns, host)
            && readyToMilk(ns, host)
    });
}

export function readyToSoften(ns: NS, host: string): boolean {
    return moneyPercentage(ns, host) <= 0.9
        && securityPercentage(ns, host) >= 0.1;
}

export function readyToBuild(ns: NS, host: string): boolean {
    return moneyPercentage(ns, host) <= 0.9
        && securityPercentage(ns, host) < 0.1;
}

export function readyToMilk(ns: NS, host: string): boolean {
    return moneyPercentage(ns, host) > 0.9
        && securityPercentage(ns, host) < 0.1;
}

function moneyPercentage(ns: NS, host: string): number {
    const curMoney = ns.getServerMoneyAvailable(host);
    const maxMoney = ns.getServerMaxMoney(host);
    return curMoney / maxMoney;
}

function securityPercentage(ns: NS, host: string): number {
    const curSec = ns.getServerSecurityLevel(host);
    const minSec = ns.getServerMinSecurityLevel(host);
    return (curSec - minSec) / minSec;
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

/** Calculate the amount that security will be reduced by when running
 *  weaken with the given number of threads.
 */
export function weakenAmount(threads: number): number {
    // We divide by 20 because 1 thread of weaken reduces security
    // by a fixed amount of 0.05, or 1/20
    return Math.floor(threads) / 20;
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

///////////////////////////////////////////
// Batch Hacking Utilities
///////////////////////////////////////////

export type BatchOptions = [
    host: string,
    target: string,
];

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


/*****************************************
 * Softening/Weakening Utilities
 *****************************************/

const weakenScript = '/batch/weaken.js';

export function calculateWeakenInstance(ns: NS, target: string) {
    let script = weakenScript;
    let threads = weakenAnalyze(ns, target, 1.0);
    const runTime = ns.getWeakenTime(target);
    return { script, threads, target, startTime: 0, runTime, endDelay: 0, loop: false };
}

export function byWeakenTime(ns: NS): ((a: string, b: string) => number) {
    return (a, b) => ns.getWeakenTime(a) - ns.getWeakenTime(b);
}


/*****************************************
 * Building/Growing Utilities
 *****************************************/

export type BatchRound = {
    target: string;
    instances: BatchScriptInstance[];
    numberOfBatches: number;
    totalBatchThreads: number;
    totalThreads: number;
};

export function calculateBuildRound(ns: NS, target: string): BatchRound {
    const maxMoney = ns.getServerMaxMoney(target);
    const currentMoney = ns.getServerMoneyAvailable(target);

    const neededGrowRatio = currentMoney > 0 ? maxMoney / currentMoney : maxMoney;
    const totalGrowThreads = growAnalyze(ns, target, neededGrowRatio);

    const instances = calculateBuildBatch(ns, target);
    const growInstance = instances[0];

    const numberOfBatches = Math.ceil(totalGrowThreads / growInstance.threads);

    const totalBatchThreads = instances.reduce((sum, i) => sum + i.threads, 0);

    const totalThreads = totalBatchThreads * numberOfBatches;

    return {
        target,
        instances,
        numberOfBatches,
        totalBatchThreads,
        totalThreads
    };
}

export function calculateBuildBatch(ns: NS, target: string): BatchScriptInstance[] {
    // Calculate minimum size efficient batch, 1 weaken thread and
    // however many grow threads it takes to generate that amount
    // of security increase.
    let growThreads = 2;
    const oneWeakenSecurityDecrease = weakenAmount(1);

    let growSecurityIncrease = ns.growthAnalyzeSecurity(growThreads, target, 1);

    while (growSecurityIncrease < oneWeakenSecurityDecrease) {
        growThreads += 1;
        growSecurityIncrease = ns.growthAnalyzeSecurity(growThreads, target, 1);
    }
    growThreads = Math.max(1, growThreads - 1);

    let growInstance = {
        target,
        script: '/batch/grow.js',
        threads: growThreads,
        startTime: 0,
        runTime: ns.getGrowTime(target),
        endDelay: 0,
        loop: false
    };

    growSecurityIncrease = ns.growthAnalyzeSecurity(growInstance.threads, target, 1);

    const weakenInstance = {
        target,
        script: '/batch/weaken.js',
        threads: weakenThreads(growSecurityIncrease),
        startTime: 0,
        runTime: ns.getWeakenTime(target),
        endDelay: 0,
        loop: false
    };

    const scriptInstances = [growInstance, weakenInstance];

    setInstanceStartTimes(scriptInstances);

    return scriptInstances;
}


/*****************************************
 * Milking/Hacking Utilities
 *****************************************/

export function byTotalThreads(ns: NS): ((a: MilkRound, b: MilkRound) => number) {
    return (a, b) => a.totalThreads - b.totalThreads;
}

export type MilkRound = {
    target: string;
    instances: BatchScriptInstance[];
    totalBatchTime: number;
    numberOfBatches: number;
    totalBatchThreads: number;
    totalThreads: number;
    batchOffset: number;
};

export async function launchMilkRound(ns: NS, host: string, milkRound: MilkRound) {
    // Start at 1 so we make 1 less batch
    for (let i = 1; i < milkRound.numberOfBatches; ++i) {
        milkRound.instances.forEach(inst => spawnBatchScript(ns, host, inst, i));
        await ns.sleep(milkRound.batchOffset);
    }
}

export function calculateMilkRound(ns: NS, target: string): MilkRound {
    const instances = calculateMilkBatch(ns, target);

    const lastScriptInstance = instances[instances.length - 1];
    const totalBatchTime = lastScriptInstance.startTime + lastScriptInstance.runTime;
    const numberOfBatches = totalBatchTime / timeAlignment;

    const totalBatchThreads = instances.reduce((sum, i) => sum + i.threads, 0);

    const totalThreads = totalBatchThreads * numberOfBatches;

    return {
        target,
        instances,
        totalBatchTime,
        numberOfBatches,
        totalBatchThreads,
        totalThreads,
        batchOffset: timeAlignment
    };
}

export function calculateMilkBatch(ns: NS, target: string): BatchScriptInstance[] {
    // To minimize per-batch thread use but maximize the value
    // rcalculateMilkBatchch, we want to choose the amount we hack
    // per bacalculateMilkBatchlarger of these two amounts:
    //  - proportion hacked by one thread
    //  - proportion grown by one thread
    //
    // Whichever is the smaller amount is then set to 1 thread, and
    // the other is calculated to achieve the same amount of growth.
    //
    // Weaken threads are then calculated based on these amounts
    // because we always need to reduce security to zero.

    // Amount of money hacked per thread
    const oneHackThreadHackPercent = ns.hackAnalyze(target);

    // Start with one thread
    let hackThreads = 1;
    let hackThreadGrowThreads;
    do {
        hackThreads += 1;
        const hackThreadsGrowPercent = hackToGrowPercent(oneHackThreadHackPercent * hackThreads);
        hackThreadGrowThreads = ns.growthAnalyze(target, hackThreadsGrowPercent);
    } while (hackThreadGrowThreads < 1);

    // Reduce number of hack threads by 1. Because we start at 1 and
    // immediately increment it this is at least 1.
    hackThreads -= 1;

    let hackInstance = {
        target,
        script: '/batch/hack.js',
        threads: hackThreads,
        startTime: 0,
        runTime: ns.getHackTime(target),
        endDelay: 0,
        loop: true
    };

    const hackSecurityIncrease = ns.hackAnalyzeSecurity(hackInstance.threads, target);

    const postHackWeakenThreads = weakenThreads(hackSecurityIncrease);
    let hackWeakenInstance = {
        target,
        script: '/batch/weaken.js',
        threads: postHackWeakenThreads,
        startTime: 0,
        runTime: ns.getWeakenTime(target),
        endDelay: 0,
        loop: true
    };

    const hackShrinkage = ns.hackAnalyze(target) * hackInstance.threads;
    const neededGrowthRatio = hackToGrowPercent(hackShrinkage);
    ns.print(`hack shrinkage: ${hackShrinkage}`);
    ns.print(`needed recovery growth: ${neededGrowthRatio}`);

    const growThreads = growAnalyze(ns, target, neededGrowthRatio + 0.1);
    let growInstance = {
        target,
        script: '/batch/grow.js',
        threads: growThreads,
        startTime: 0,
        runTime: ns.getGrowTime(target),
        endDelay: 0,
        loop: true
    };

    // N.B. In order to speculatively calculate how much security will
    // increase, we must _not_ specify the target server. Doing so
    // will cap the projected security growth by the amount of grow
    // threads needed to grow the specified server to max money, and
    // currently we know that server is at max money already, thus
    // security growth will be reported as zero.
    const growSecurityIncrease = ns.growthAnalyzeSecurity(growInstance.threads);

    const postGrowWeakenThreads = weakenThreads(growSecurityIncrease);
    let growWeakenInstance = {
        target,
        script: '/batch/weaken.js',
        threads: postGrowWeakenThreads,
        startTime: 0,
        runTime: ns.getWeakenTime(target),
        endDelay: 0,
        loop: true
    };

    const scriptInstances = [hackInstance, hackWeakenInstance, growInstance, growWeakenInstance];

    setInstanceStartTimes(scriptInstances);

    return scriptInstances;
}

export function byAvailableRam(ns: NS): ((a: string, b: string) => number) {
    return (a, b) => availableRam(ns, b) - availableRam(ns, a);
}

export function hackToGrowPercent(hackPercent: number): number {
    return 1 / (1 - hackPercent);
}

export function growToHackPercent(growPercent: number): number {
    return 1 - (1 / growPercent);
}

export type BatchScriptInstance = {
    target: string;
    script: string;
    threads: number;
    startTime: number;
    runTime: number;
    endDelay: number;
    loop: boolean;
};

export const minimumTimeDelta = 150;
export const timeAlignment = 1000;

export function setInstanceStartTimes(scriptInstances: BatchScriptInstance[]): void {
    let endTime = 0;
    scriptInstances.forEach(i => {
        i.startTime = endTime - i.runTime;
        endTime += minimumTimeDelta;
    });
    // Get relative end time of final instance
    const relativeBatchEndTime = endTime - minimumTimeDelta;

    // Determine offset to bring most negative start time to zero
    let earliestStartTime = -Math.min(...scriptInstances.map(i => i.startTime));

    // Calculate actual batch end time
    const actualEndTime = relativeBatchEndTime + earliestStartTime;

    // Pad out batch so that actualEndTime is aligned to the time alignment interval
    if (actualEndTime > 1000) {
        const padding = 1000 - (actualEndTime % timeAlignment);
        earliestStartTime += padding;
    }

    // Push forward all start times so earliest one is zero
    scriptInstances.forEach(i => {
        i.startTime += earliestStartTime;
        i.endDelay = actualEndTime - (i.startTime + i.runTime);
    });
}

export function spawnBatchScript(ns: NS, host: string, scriptInstance: BatchScriptInstance, ...extraArgs: (string | number | boolean)[]) {
    const { script, threads, target, startTime } = scriptInstance;
    if (threads > 0) {
        let args = [target, startTime, ...extraArgs];
        if (scriptInstance.loop) args.unshift('--loop');

        ns.exec(script, host, threads, ...args);
    }
}

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

    exec(ns: NS, host: string, ...extraArgs: ScriptArgs[]): BatchInstance {
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
