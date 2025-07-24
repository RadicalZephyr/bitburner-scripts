import type { AutocompleteData, NS } from 'netscript';

import { MEM_TAG_FLAGS } from 'services/client/memory_tag';
import { FreeChunk, FreeRam } from 'services/client/memory';
import {
    BatchLogistics,
    BatchPhase,
    calculatePhaseStartTimes,
} from 'services/batch';

import { CONFIG } from 'batch/config';

export interface BatchThreadAnalysis {
    hackThreads: number;
    postHackWeakenThreads: number;
    growThreads: number;
    postGrowWeakenThreads: number;
}

export function autocomplete(data: AutocompleteData): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    ns.flags(MEM_TAG_FLAGS);
    const target = ns.args[0];
    if (typeof target !== 'string' || !ns.serverExists(target)) {
        ns.tprintf('target %s does not exist', target);
        return;
    }

    const eValue = expectedValuePerRamSecond(ns, target);
    ns.tprint(`${target} ${eValue}`);
}

/** Calculate the number of hack threads needed to steal the given
 *  percentage of the target server's max money.
 *
 * @param ns - Netscript API instance
 * @param host - Hostname of the target server
 * @param percent - Desired money percentage to hack (0-1)
 * @returns Required hack thread count adjusted for hacking multipliers
 */
export function hackThreadsForPercent(
    ns: NS,
    host: string,
    percent: number,
): number {
    if (percent <= 0) return 0;

    let hackPercent: number;
    if (canUseFormulas(ns)) {
        const player = ns.getPlayer();
        const server = ns.getServer(host);
        server.moneyAvailable = server.moneyMax;
        server.hackDifficulty = server.minDifficulty;

        hackPercent = ns.formulas.hacking.hackPercent(server, player);
    } else {
        hackPercent = ns.hackAnalyze(host);
    }

    if (hackPercent <= 0) return 0;

    return Math.ceil(percent / hackPercent);
}

/**
 * Calculate the expected monetary value generated per RAM-second for a full
 * hacking batch using built-in Netscript analysis functions.
 *
 * @param ns      - Netscript API instance
 * @param host    - Hostname of the target server
 * @param spacing - Delay (ms) between batch phases
 * @returns Expected value per RAM-second
 */
export function expectedValuePerRamSecond(
    ns: NS,
    host: string,
    hackPercent: number = CONFIG.maxHackPercent,
): number {
    const logistics = calculateBatchLogistics(ns, host, hackPercent);

    const profitPerSecond = harvestProfit(
        ns,
        host,
        hackPercent,
        logistics.endingPeriod,
    );
    const requiredRam = logistics.requiredRam;

    return profitPerSecond / requiredRam;
}

/** Calculate the total runtime for a full hack-weaken-grow-weaken batch.
 *
 * @param ns   - Netscript API instance
 * @param host - Hostname of the target server
 * @returns Time in milliseconds for one batch to finish, adjusted for
 * the player's hacking speed multiplier
 */
export function fullBatchTime(ns: NS, host: string): number {
    return ns.getWeakenTime(host) + 2 * CONFIG.batchInterval;
}

/**
 * Determine how many full batch allocations fit in the provided chunks.
 *
 * @param chunks    - List of worker chunks and free RAM sizes
 * @param batchRam  - RAM required for a single batch
 * @returns Number of batches that can fit in memory
 */
export function availableBatchCount(
    chunks: FreeChunk[],
    batchRam: number,
): number {
    if (batchRam <= 0) return 0;
    return chunks.reduce((sum, c) => sum + Math.floor(c.freeRam / batchRam), 0);
}

/**
 * Find the maximum hack percent that can run with the provided memory info.
 *
 * The search first attempts to satisfy the full overlap requirement. If even
 * the minimal batch cannot fit, it relaxes the requirement to just a single
 * batch.
 *
 * @param ns      - Netscript API instance
 * @param host    - Hostname of the target server
 * @param memInfo - Current free memory snapshot
 * @returns Largest hack percent that fits in memory
 */
export function maxHackPercentForMemory(
    ns: NS,
    host: string,
    memInfo: FreeRam,
): number {
    const minPercent = (() => {
        if (canUseFormulas(ns)) {
            const server = ns.getServer(host);
            const player = ns.getPlayer();
            return ns.formulas.hacking.hackPercent(server, player);
        }
        return ns.hackAnalyze(host);
    })();

    const minLog = calculateBatchLogistics(ns, host, minPercent);
    const minChunks = availableBatchCount(memInfo.chunks, minLog.batchRam);
    if (minChunks === 0 || memInfo.freeRam < minLog.batchRam) return 0;

    const checkFull =
        minChunks >= minLog.overlap && memInfo.freeRam >= minLog.requiredRam;

    let low = minPercent;
    let high = CONFIG.maxHackPercent;
    for (let i = 0; i < 16; i++) {
        const mid = (low + high) / 2;
        const log = calculateBatchLogistics(ns, host, mid);
        const chunks = availableBatchCount(memInfo.chunks, log.batchRam);
        const fitsFull = checkFull
            ? log.requiredRam <= memInfo.freeRam && chunks >= log.overlap
            : log.batchRam <= memInfo.freeRam && chunks >= 1;
        if (fitsFull) {
            low = mid;
        } else {
            high = mid;
        }
    }

    return low;
}

/**
 * Estimate expected value per RAM-second using current memory limits.
 *
 * @param ns      - Netscript API instance
 * @param host    - Hostname of the target server
 * @param memInfo - Current free memory snapshot
 * @returns Expected value per RAM-second
 */
export function expectedValueForMemory(
    ns: NS,
    host: string,
    memInfo: FreeRam,
): number {
    const hackPercent = maxHackPercentForMemory(ns, host, memInfo);
    if (hackPercent === 0) return 0;

    const logistics = calculateBatchLogistics(ns, host, hackPercent);
    const batchCount = Math.min(
        logistics.overlap,
        availableBatchCount(memInfo.chunks, logistics.batchRam),
    );
    if (batchCount === 0) return 0;

    const profitPerSecond = harvestProfit(
        ns,
        host,
        hackPercent,
        logistics.endingPeriod,
    );

    const overlapCompleteness = batchCount / logistics.overlap;
    const scaledProfitPerSecond = profitPerSecond * overlapCompleteness;
    const requiredRam = logistics.batchRam * batchCount;

    return scaledProfitPerSecond / requiredRam;
}

/**
 * Calculate the expected profit of hacking this target.
 *
 * @param ns           - Netscript API instance
 * @param target       - Target server
 * @param hackPercent  - Percent of server money to hack each batch
 * @param endingPeriod - Batch ending period {@see harvestBatchEndingPeriod}
 * @returns Calculated profits per second
 */

export function harvestProfit(
    ns: NS,
    target: string,
    hackPercent: number,
    endingPeriod: number,
) {
    const hackThreads = hackThreadsForPercent(ns, target, hackPercent);
    const hackValue = successfulHackValue(ns, target, hackThreads);
    const expectedHackValue = hackValue * hackAnalyzeChance(ns, target);

    const batchesPerSecond = 1000 / endingPeriod;
    return expectedHackValue * batchesPerSecond;
}

function successfulHackValue(ns: NS, host: string, threads: number): number {
    const server = ns.getServer(host);

    if (canUseFormulas(ns)) {
        const player = ns.getPlayer();
        server.moneyAvailable = server.moneyMax;
        server.hackDifficulty = server.minDifficulty;
        const percent = ns.formulas.hacking.hackPercent(server, player);
        return threads * server.moneyMax * percent;
    }

    return threads * server.moneyMax * ns.hackAnalyze(host);
}

function hackAnalyzeChance(ns: NS, target: string) {
    if (canUseFormulas(ns)) {
        const player = ns.getPlayer();
        const server = ns.getServer(target);
        server.moneyAvailable = server.moneyMax;
        server.hackDifficulty = server.minDifficulty;
        return ns.formulas.hacking.hackChance(server, player);
    } else {
        return ns.hackAnalyzeChance(target);
    }
}

/**
 * Calculate the minimal thread distribution for a HWGW batch.
 *
 * @param ns - Netscript API instance
 * @param host - Hostname of the target server
 * @param hackThreads - Number of hack threads to execute
 * @returns Calculated thread allocation
 */
export function analyzeBatchThreads(
    ns: NS,
    host: string,
    hackThreads: number = 1,
): BatchThreadAnalysis {
    const stolen = successfulHackValue(ns, host, hackThreads);
    const maxMoney = ns.getServer(host).moneyMax;
    const afterHackMoney = Math.max(1, maxMoney - stolen);

    const growThreads = growthAnalyze(ns, host, afterHackMoney);

    const hackSecInc = ns.hackAnalyzeSecurity(hackThreads);
    const growSecInc = ns.growthAnalyzeSecurity(growThreads);

    return {
        hackThreads,
        postHackWeakenThreads: weakenThreadsNeeded(hackSecInc),
        growThreads,
        postGrowWeakenThreads: weakenThreadsNeeded(growSecInc),
    };
}

/** Calculate the number of grow threads needed for a given multiplicative growth factor.
 *
 * @remarks
 * This function returns the total decimal number of grow threads
 * needed in order to multiply the money available on the specified
 * server by a given multiplier, if all threads are executed at the
 * server's current security level, regardless of how many threads are
 * assigned to each call. The result is normalized for the player's
 * grow thread multiplier.
 *
 * @param ns - Netscript API instance
 * @param hostname - Hostname of the target server
 * @param afterHackMoney - Remaining money after the hack completes
 */
export function growthAnalyze(
    ns: NS,
    hostname: string,
    afterHackMoney: number,
): number {
    if (canUseFormulas(ns)) {
        const server = ns.getServer(hostname);
        const player = ns.getPlayer();
        server.moneyAvailable = afterHackMoney;
        return Math.ceil(
            ns.formulas.hacking.growThreads(server, player, server.moneyMax),
        );
    } else {
        // N.B. from testing this calculation tracks very closely with
        // the formulas value, _except_ as the afterHackMoney
        // approaches zero the error grows super-linearly
        const maxMoney = ns.getServer(hostname).moneyMax;
        const growMultiplier = maxMoney / Math.max(1, afterHackMoney);
        return Math.ceil(ns.growthAnalyze(hostname, growMultiplier));
    }
}

/** Calculate RAM and phase information for a full harvest batch.
 *
 * @param ns          - Netscript API instance
 * @param target      - Hostname of the target server
 * @param hackPercent - Fraction of money to hack each batch (0-1)
 */

export function calculateBatchLogistics(
    ns: NS,
    target: string,
    hackPercent?: number,
): BatchLogistics {
    const hackThreads =
        hackPercent !== undefined
            ? hackThreadsForPercent(ns, target, hackPercent)
            : 1;
    const threads = analyzeBatchThreads(ns, target, hackThreads);

    const phases = calculateBatchPhases(ns, target, threads);

    const hRam = ns.getScriptRam('/batch/h.js', 'home') * threads.hackThreads;
    const gRam = ns.getScriptRam('/batch/g.js', 'home') * threads.growThreads;
    const wRam =
        ns.getScriptRam('/batch/w.js', 'home')
        * (threads.postHackWeakenThreads + threads.postGrowWeakenThreads);
    const batchRam = hRam + gRam + wRam;

    const batchTime = fullBatchTime(ns, target);

    const endingPeriod = harvestBatchEndingPeriod();
    const overlap = Math.ceil(batchTime / endingPeriod);
    const requiredRam = batchRam * overlap;

    return {
        target,
        batchRam,
        overlap,
        endingPeriod,
        requiredRam,
        phases,
    };
}

/**
 * Calculate how long the critical period during batch ending is.
 *
 * @remarks One of the premises of batch hacking is that the number of
 * threads in each phase and the phase ordering is calculated such
 * that after all phases of a batch are complete the target will be
 * left in the same state it was in before the batch started.
 *
 * For this to actually hold true, batches phases need to end in the
 * correct order, and batches need to end serially with no
 * interleaving of phases from different batches.
 *
 * Because each Netscript action takes some time to actually commit,
 * we need to plan for an interval between each phase of a batch
 * ending the `CONFIG.batchInterval`. Similarly, we need to have an
 * interval between the last phase of one batch ending and the first
 * phase of the next batch ending.
 *
 * This function calculates the duration when one batch has exclusive
 * "ending rights" to a particular target.
 *
 * @returns The time in milliseconds for all phases of a batch to
 * complete.
 */
export function harvestBatchEndingPeriod(): number {
    return CONFIG.batchInterval * 4;
}

/**
 * Calculate relative start times for a batch.
 *
 * Calculate the phase order and relative start times for a full
 * H-W-G-W batch so that each script ends `CONFIG.batchInterval`
 * milliseconds after the previous one. Durations account for the
 * player's hacking speed multiplier.
 *
 * @param ns      - Netscript API instance
 * @param target  - Target server
 * @param threads - Batch thread sizes
 * @returns A list of ordered phases with start time delays so they all end in phase order.
 */
export function calculateBatchPhases(
    ns: NS,
    target: string,
    threads: BatchThreadAnalysis,
): BatchPhase[] {
    const hackTime = ns.getHackTime(target);
    const weakenTime = ns.getWeakenTime(target);
    const growTime = ns.getGrowTime(target);

    const phases: BatchPhase[] = [
        {
            script: '/batch/h.js',
            start: 0,
            duration: hackTime,
            threads: threads.hackThreads,
        },
        {
            script: '/batch/w.js',
            start: 0,
            duration: weakenTime,
            threads: threads.postHackWeakenThreads,
        },
        {
            script: '/batch/g.js',
            start: 0,
            duration: growTime,
            threads: threads.growThreads,
        },
        {
            script: '/batch/w.js',
            start: 0,
            duration: weakenTime,
            threads: threads.postGrowWeakenThreads,
        },
    ];

    return calculatePhaseStartTimes(phases);
}

function weakenThreadsNeeded(securityDecrease: number): number {
    // N.B. this function cannot be substited with the ns function
    // weaken analyze because they do opposite things!
    return Math.max(1, Math.ceil(securityDecrease * 20));
}

function canUseFormulas(ns: NS): boolean {
    return ns.fileExists('Formulas.exe', 'home');
}
