import type { NS } from "netscript";

export const factionServers = [
    "CSEC",
    "avmnite-02h",
    "I.I.I.I",
    "run4theh111z"
];

export type PortProgram = "BruteSSH.exe" |
    "FTPCrack.exe" |
    "relaySMTP.exe" |
    "HTTPWorm.exe" |
    "SQLInject.exe"
    ;
export const portOpeningPrograms: PortProgram[] = [
    "BruteSSH.exe",
    "FTPCrack.exe",
    "relaySMTP.exe",
    "HTTPWorm.exe",
    "SQLInject.exe"
];

/** Get list of all hosts.
 */
export function getAllHosts(ns: NS): string[] {
    let existingHosts = publicHosts.filter(h => ns.serverExists(h));
    return ['home', ...getOwnedServers(ns), ...existingHosts];
}

/** Get list of purchased servers.
 */
export function getOwnedServers(ns: NS): string[] {
    return ns.scan('home').filter(host => host.startsWith('pserv'));
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


//////////////////////////////////////////
// Host Filtering Utilities
//////////////////////////////////////////

/** Filter hosts by whether they have any ram available.
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

/** Filter hosts by whether they have money and can be nuked.
 */
export function targetableHosts(ns: NS, hosts: string[]): string[] {
    return hosts.filter((host) => {
        return ns.serverExists(host)
            && canNuke(ns, host)
            && hasMoney(ns, host);
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

//////////////////////////////////////////
// Server Details Utilities
//////////////////////////////////////////

/** Check if node is a valid target
 */
export function validTarget(ns: NS, node: any) {
    return typeof (node) == "string" && ns.serverExists(node);
}

/** Determine total amount of RAM available for running scripts.
 */
export function availableRam(ns: NS, node: string): number {
    return ns.getServerMaxRam(node) - ns.getServerUsedRam(node);
}

/** Calculate the number of threads this script can be run with on this node.
 */
export function numThreads(ns: NS, node: string, hackScript: string, percentage?: number): number {
    percentage = percentage ? percentage : 1.0;
    let hackScriptRam = ns.getScriptRam(hackScript);
    let availableNodeRam = availableRam(ns, node);
    return Math.floor(availableNodeRam * percentage / hackScriptRam);
}

/** Calculate a metric to make the largest amount of available RAM
 *  produce the smallest number.
 *
 *  The purpose of this is to allow using the min-heap implementation
 *  to sort hosts by highest available RAM.
 */
export function inverseAvailableRam(ns: NS, host: string): number {
    const usedRam = ns.getServerUsedRam(host);
    const maxRam = ns.getServerMaxRam(host);
    const availableRam = maxRam - usedRam;
    if (availableRam === 0) return +Infinity;
    return 1 / availableRam;
}

/** Determine how far below maximum money a host currently is.
 */
export function moneyPercentage(ns: NS, host: string): number {
    const curMoney = ns.getServerMoneyAvailable(host);
    const maxMoney = ns.getServerMaxMoney(host);
    return curMoney / maxMoney;
}

/** Determine how far above minimum security a host currently is.
 */
export function securityPercentage(ns: NS, host: string): number {
    const curSec = ns.getServerSecurityLevel(host);
    const minSec = ns.getServerMinSecurityLevel(host);
    return (curSec - minSec) / minSec;
}

/** Check if a host has a non-zero money capacity.
 */
export function hasMoney(ns: NS, host: string): boolean {
    return ns.getServerMaxMoney(host) > 0;
}

/** Check if a host has non-zero RAM.
 */
export function hasRam(ns: NS, host: string): boolean {
    return ns.getServerMaxRam(host) > 0;
}


//////////////////////////////////////////
// Hacking Analysis Utilities
//////////////////////////////////////////

/** Calculate the number of threads needed to build the server by a
 * certain multiplier.
 */
export function buildAnalyze(ns: NS, target: string, buildAmount: number): number {
    if (buildAmount >= 1) {
        return Math.ceil(ns.growthAnalyze(target, buildAmount, 1));
    } else {
        return 0;
    }
}

/** Calculate the number of threads needed to steal a certain
 *  percentage of the money on the target.
 */
export function stealAnalyze(ns: NS, target: string, hackAmount: number): number {
    const oneThreadStealAmount = ns.hackAnalyze(target);
    return Math.ceil(hackAmount / oneThreadStealAmount);
}

/** Calculate the number of threads needed to soften the `target` by
 * the given multiplier.
 */
export function softenAnalyze(ns: NS, target: string, softenAmount: number): number {
    const currentSecurity = ns.getServerSecurityLevel(target);
    const minSecurity = ns.getServerMinSecurityLevel(target);
    return softenThreads((currentSecurity - minSecurity) * softenAmount);
}

/** Calculate the number of threads to soften any server by the given amount.
 */
export function softenThreads(softenAmount: number): number {
    // We multiply by 20 because 1 thread of weaken reduces security
    // by a fixed amount of 0.05, or 1/20
    return Math.ceil(softenAmount * 20);
}

/** Calculate the amount that security will be reduced by when running
 *  soften with the given number of threads.
 */
export function softenAmount(threads: number): number {
    // We divide by 20 because 1 thread of weaken reduces security
    // by a fixed amount of 0.05, or 1/20
    return Math.floor(threads) / 20;
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

export function byAvailableRam(ns: NS): ((a: string, b: string) => number) {
    return (a, b) => availableRam(ns, b) - availableRam(ns, a);
}

export function hToGPercent(hPercent: number): number {
    return 1 / (1 - hPercent);
}

export function gToHPercent(gPercent: number): number {
    return 1 - (1 / gPercent);
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
export const timeAlignment = 2000;

export function setInstanceStartTimes(scriptInstances: BatchScriptInstance[]): void {
    let endTime = 0;
    scriptInstances.forEach(i => {
        i.startTime = endTime - i.runTime;
        endTime += minimumTimeDelta;
    });
    // Get relative end time of final instance
    // N.B. subtract one time delta to account for final loop increment
    const relativeBatchEndTime = endTime - minimumTimeDelta;

    // Determine offset to bring most negative start time to zero
    let earliestStartTime = Math.abs(Math.min(...scriptInstances.map(i => i.startTime)));

    // Calculate actual batch end time
    let actualEndTime = relativeBatchEndTime + earliestStartTime;

    // Pad out batch so that actualEndTime is aligned to the time alignment interval
    if (actualEndTime > timeAlignment) {
        const padding = timeAlignment - (actualEndTime % timeAlignment);
        actualEndTime += padding;
        earliestStartTime += padding;
    }

    // Push forward all start times so earliest one is zero
    scriptInstances.forEach(i => {
        i.startTime += earliestStartTime;
        const scriptEndTime = i.startTime + i.runTime;
        // Calculate end delay based on how much time elapses between
        // the end of this script and the end of the entire
        // batch. This should basically be set by the ending order.
        i.endDelay = actualEndTime - scriptEndTime;
    });
}

type ScriptArgs = (string | number | boolean);

export function spawnBatchScript(ns: NS, host: string, scriptInstance: BatchScriptInstance, ...extraArgs: ScriptArgs[]) {
    const { script, threads, target, startTime, endDelay } = scriptInstance;
    if (threads > 0) {
        let args = [target, startTime, endDelay, ...extraArgs];
        if (scriptInstance.loop) args.unshift('--loop');

        return ns.exec(script, host, threads, ...args);
    }
}


/*****************************************
 * Batch Lifecycle Filtering Utilities
 *****************************************/

export class TargetThreads {
    h: number;
    mMoney: number;
    hN: number;
    hAvgMoney: number;
    hPid: number[];
    g: number;
    gPid: number[];
    w: number;
    wPid: number[];

    constructor() {
        this.h = 0;
        this.mMoney = 0;
        this.hN = 0;
        this.hAvgMoney = 0;
        this.hPid = [];
        this.g = 0;
        this.gPid = [];
        this.w = 0;
        this.wPid = [];
    }
}

export function byHackLevel(ns: NS): ((a: string, b: string) => number) {
    return (a, b) => ns.getServerRequiredHackingLevel(a) - ns.getServerRequiredHackingLevel(b);
}

export function byMaxMoneyDescending(ns: NS): ((a: string, b: string) => number) {
    return (a, b) => ns.getServerMaxMoney(b) - ns.getServerMaxMoney(a);
}

export function countThreadsByTarget(ns: NS, hosts: string[]): Map<string, TargetThreads> {
    let targetThreads = new Map(hosts.map(h => [h, new TargetThreads()]));

    for (const host of hosts) {
        for (const pi of ns.ps(host)) {

            let target = pi.args[0] === '--loop' ? pi.args[1] : pi.args[0] === '--scale' ? pi.args[2] : pi.args[0];
            let targetThread = targetThreads.get(target);

            if (pi.filename === '/batch/milk.js') {
                targetThread.mMoney = ns.getScriptIncome(pi.filename, host, ...pi.args);
            } else if (pi.filename === '/batch/hack.js') {
                targetThread.hPid.push(pi.pid);
                targetThread.h += pi.threads;
                const totalMoney = ns.getScriptIncome(pi.filename, host, ...pi.args);
                if (Math.abs(totalMoney) > 1) {
                    targetThread.hN += 1;
                    const n = targetThread.hN;
                    targetThread.hAvgMoney = ((n - 1) / n) * targetThread.hAvgMoney + totalMoney * (1 / n);
                }
            } else if (pi.filename === '/batch/grow.js') {
                targetThread.gPid.push(pi.pid);
                targetThread.g += pi.threads;
            } else if (pi.filename === '/batch/weaken.js') {
                targetThread.wPid.push(pi.pid);
                targetThread.w += pi.threads;
            }
        }
    }

    return targetThreads;
}

type AllTargetThreads = Map<string, TargetThreads>;

/** Filter for hosts that are ready to be softened.
 */
export function readyToSoftenHosts(ns: NS, allTargetThreads: AllTargetThreads, hosts: string[]): string[] {
    return hosts.filter((host) => {
        const targetThreads = allTargetThreads.get(host);
        return ns.serverExists(host)
            && targetThreads !== undefined
            && hasMoney(ns, host)
            && canNuke(ns, host)
            && readyToSoften(ns, targetThreads, host);
    });
}

/** Filter for hosts that are ready to be built.
 */
export function readyToBuildHosts(ns: NS, allTargetThreads: AllTargetThreads, hosts: string[]): string[] {
    return hosts.filter((host) => {
        const targetThreads = allTargetThreads.get(host);
        return ns.serverExists(host)
            && targetThreads !== undefined
            && hasMoney(ns, host)
            && canNuke(ns, host)
            && readyToBuild(ns, targetThreads, host);
    });
}

/** Filter for hosts that are ready to be milked.
 */
export function readyToMilkHosts(ns: NS, allTargetThreads: AllTargetThreads, hosts: string[]): string[] {
    return hosts.filter((host) => {
        const targetThreads = allTargetThreads.get(host);
        return ns.serverExists(host)
            && targetThreads !== undefined
            && hasMoney(ns, host)
            && canHack(ns, host)
            && readyToMilk(ns, targetThreads, host);
    });
}

export function readyToSoften(ns: NS, targetThreads: TargetThreads, host: string): boolean {
    return noThreads(targetThreads)
        && moneyPercentage(ns, host) <= 0.9
        && securityPercentage(ns, host) >= 0.1;
}

export function readyToBuild(ns: NS, targetThreads: TargetThreads, host: string): boolean {
    return noThreads(targetThreads)
        && moneyPercentage(ns, host) <= 0.9
        && securityPercentage(ns, host) < 0.1;
}

export function readyToMilk(ns: NS, targetThreads: TargetThreads, host: string): boolean {
    return noThreads(targetThreads)
        && moneyPercentage(ns, host) > 0.9
        && securityPercentage(ns, host) < 0.1;
}

/** Filter for hosts that are actively being softened.
 */
export function softeningHosts(ns: NS, allTargetThreads: AllTargetThreads, hosts: string[]): string[] {
    return hosts.filter((host) => {
        const targetThreads = allTargetThreads.get(host);
        return ns.serverExists(host)
            && targetThreads !== undefined
            && hasMoney(ns, host)
            && canHack(ns, host)
            && isSoftening(targetThreads);
    });
}

/** Filter for hosts that are actively being built.
 */
export function buildingHosts(ns: NS, allTargetThreads: AllTargetThreads, hosts: string[]): string[] {
    return hosts.filter((host) => {
        const targetThreads = allTargetThreads.get(host);
        return ns.serverExists(host)
            && targetThreads !== undefined
            && hasMoney(ns, host)
            && canHack(ns, host)
            && isBuilding(targetThreads);
    });
}

/** Filter for hosts that are actively being milked.
 */
export function milkingHosts(ns: NS, allTargetThreads: AllTargetThreads, hosts: string[]): string[] {
    return hosts.filter((host) => {
        const targetThreads = allTargetThreads.get(host);
        return ns.serverExists(host)
            && targetThreads !== undefined
            && hasMoney(ns, host)
            && canHack(ns, host)
            && isMilking(targetThreads);
    });
}

function isSoftening(targetThreads: TargetThreads): boolean {
    return targetThreads.h === 0
        && targetThreads.g === 0
        && targetThreads.w > 0;
}

function isBuilding(targetThreads: TargetThreads): boolean {
    return targetThreads.h === 0
        && targetThreads.g > 0
        && targetThreads.w > 0;
}

function isMilking(targetThreads: TargetThreads): boolean {
    return targetThreads.h > 0
        && targetThreads.g > 0
        && targetThreads.w > 0;
}

function noThreads(targetThreads: TargetThreads): boolean {
    return targetThreads.h === 0
        && targetThreads.g === 0
        && targetThreads.w === 0;
}


/*****************************************
 * Softening/Weakening Utilities
 *****************************************/

const weakenScript = '/batch/weaken.js';

export function calculateWeakenInstance(ns: NS, target: string) {
    let script = weakenScript;
    let threads = softenAnalyze(ns, target, 1.0);
    const runTime = ns.getWeakenTime(target);
    return { script, threads, target, startTime: 0, runTime, endDelay: 0, loop: false };
}

export function byWeakenTime(ns: NS): ((a: string, b: string) => number) {
    return (a, b) => ns.getWeakenTime(a) - ns.getWeakenTime(b);
}


/*****************************************
 * Building Utilities
 *****************************************/

function neededGThreads(ns: NS, target: string) {
    const maxMoney = ns.getServerMaxMoney(target);
    const currentMoney = ns.getServerMoneyAvailable(target);

    const neededGrowRatio = currentMoney > 0 ? maxMoney / currentMoney : maxMoney;
    const totalGrowThreads = buildAnalyze(ns, target, neededGrowRatio);
    return totalGrowThreads;
}

export type BatchRound = {
    target: string;
    instances: BatchScriptInstance[];
    numberOfBatches: number;
    totalBatchThreads: number;
    totalThreads: number;
};

export function calculateBuildRound(ns: NS, target: string): BatchRound {
    const totalGrowThreads = neededGThreads(ns, target);

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
    const oneWeakenSecurityDecrease = softenAmount(1);

    const maxGrowThreads = neededGThreads(ns, target);
    let growSecurityIncrease = ns.growthAnalyzeSecurity(growThreads, target, 1);

    while (growThreads <= maxGrowThreads && growSecurityIncrease < oneWeakenSecurityDecrease) {
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
        threads: softenThreads(growSecurityIncrease),
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

export function calculateMilkRound(ns: NS, target: string, hackPercent: number): MilkRound {
    const instances = calculateMilkBatch(ns, target, hackPercent);

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

export function calculateMilkBatch(ns: NS, target: string, hackPercent: number): BatchScriptInstance[] {
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

    let hackThreads = Math.floor(hackPercent / oneHackThreadHackPercent);

    let hackThreadGrowThreads;
    do {
        hackThreads += 1;
        const hackThreadsGrowPercent = hToGPercent(oneHackThreadHackPercent * hackThreads);
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
        loop: false
    };

    const hackSecurityIncrease = ns.hackAnalyzeSecurity(hackInstance.threads, target);

    const postHackWeakenThreads = softenThreads(hackSecurityIncrease);
    let hackWeakenInstance = {
        target,
        script: '/batch/weaken.js',
        threads: postHackWeakenThreads,
        startTime: 0,
        runTime: ns.getWeakenTime(target),
        endDelay: 0,
        loop: false
    };

    const hackShrinkage = ns.hackAnalyze(target) * hackInstance.threads;
    const neededGrowthRatio = hToGPercent(hackShrinkage);
    ns.print(`hack shrinkage: ${hackShrinkage}`);
    ns.print(`needed recovery growth: ${neededGrowthRatio}`);

    const growThreads = buildAnalyze(ns, target, neededGrowthRatio + 0.1);
    let growInstance = {
        target,
        script: '/batch/grow.js',
        threads: growThreads,
        startTime: 0,
        runTime: ns.getGrowTime(target),
        endDelay: 0,
        loop: false
    };

    // N.B. In order to speculatively calculate how much security will
    // increase, we must _not_ specify the target server. Doing so
    // will cap the projected security growth by the amount of grow
    // threads needed to grow the specified server to max money, and
    // currently we know that server is at max money already, thus
    // security growth will be reported as zero.
    const growSecurityIncrease = ns.growthAnalyzeSecurity(growInstance.threads);

    const postGrowWeakenThreads = softenThreads(growSecurityIncrease);
    let growWeakenInstance = {
        target,
        script: '/batch/weaken.js',
        threads: postGrowWeakenThreads,
        startTime: 0,
        runTime: ns.getWeakenTime(target),
        endDelay: 0,
        loop: false
    };

    const scriptInstances = [hackInstance, hackWeakenInstance, growInstance, growWeakenInstance];

    setInstanceStartTimes(scriptInstances);

    return scriptInstances;
}


//////////////////////////////////////////
// Server Purchase Utilities
//////////////////////////////////////////

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

    while (ram * 2 <= maxServerRam && maxPerServerSpend > ns.getPurchasedServerCost(ram)) {
        ram *= 2;
    }

    return ram / 2;
}


//////////////////////////////////////////
// Formatting Utilities
//////////////////////////////////////////

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


//////////////////////////////////////////
// Heap Implementation
//////////////////////////////////////////

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


//////////////////////////////////////////
// Iterator Utilities
//////////////////////////////////////////

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


//////////////////////////////////////////
// Network Walking Utilities
//////////////////////////////////////////

export function walkNetworkBFS(ns: NS): Map<string, string[]> {
    return walkNetwork(ns, { 'order': 'breadth' });
}

export function walkNetworkDFS(ns: NS): Map<string, string[]> {
    return walkNetwork(ns, { 'order': 'depth' });
}

export type WalkOrder = 'breadth' | 'depth';

export type WalkOptions = {
    'order': WalkOrder,
};

type NextNodeFn = ((nodes: string[]) => string);

/** Walk the network and return an array of all hosts.
 *
 */
export function walkNetwork(ns: NS, options?: WalkOptions): Map<string, string[]> {
    const nextNode: NextNodeFn = options && options.order === 'depth'
        ? (n) => n.pop()
        : (n) => n.shift();

    let root = 'home';
    let nodesToExplore = [];
    let explored = new Set();
    let network = new Map();

    explored.add(root);
    nodesToExplore.push(root);

    while (nodesToExplore.length > 0) {
        let v = nextNode(nodesToExplore);

        let edges = ns.scan(v);
        network.set(v, edges);

        for (const w of edges) {
            if (!explored.has(w)) {
                explored.add(w);
                nodesToExplore.push(w);
            }
        }
    }
    return network;
}

export const publicHosts = [
    ".",
    "4sigma",
    "CSEC",
    "I.I.I.I",
    "The-Cave",
    "aerocorp",
    "aevum-police",
    "alpha-ent",
    "applied-energetics",
    "avmnite-02h",
    "b-and-a",
    "blade",
    "catalyst",
    "clarkinc",
    "computek",
    "crush-fitness",
    "darkweb",
    "defcomm",
    "deltaone",
    "ecorp",
    "foodnstuff",
    "fulcrumassets",
    "fulcrumtech",
    "galactic-cyber",
    "global-pharm",
    "harakiri-sushi",
    "helios",
    "hong-fang-tea",
    "icarus",
    "infocomm",
    "iron-gym",
    "joesguns",
    "johnson-ortho",
    "kuai-gong",
    "lexo-corp",
    "max-hardware",
    "megacorp",
    "microdyne",
    "millenium-fitness",
    "n00dles",
    "nectar-net",
    "neo-net",
    "netlink",
    "nova-med",
    "nwo",
    "omega-net",
    "omnia",
    "omnitek",
    "phantasy",
    "powerhouse-fitness",
    "rho-construction",
    "rothman-uni",
    "run4theh111z",
    "sigma-cosmetics",
    "silver-helix",
    "snap-fitness",
    "solaris",
    "stormtech",
    "summit-uni",
    "syscore",
    "taiyang-digital",
    "the-hub",
    "titan-labs",
    "unitalife",
    "univ-energy",
    "vitalife",
    "zb-def",
    "zb-institute",
    "zer0",
    "zeus-med"
];
