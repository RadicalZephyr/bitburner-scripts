import type { AutocompleteData, NS } from 'netscript';
import { ALLOC_ID, MEM_TAG_FLAGS } from 'services/client/memory_tag';

import {
    BatchLogistics,
    BatchPhase,
    calculatePhaseStartTimes,
    spawnBatch,
} from 'services/batch';

import { parseAndRegisterAlloc } from 'services/client/memory';
import { GrowableMemoryClient } from 'services/client/growable_memory';

import { CONFIG } from 'batch/config';
import {
    awaitRound,
    calculateRoundInfo,
    printRoundProgress,
    RoundInfo,
} from 'batch/progress';

import { TaskSelectorClient, Lifecycle } from 'batch/client/task_selector';
import { growthAnalyze } from 'util/growthAnalyze';

export function autocomplete(data: AutocompleteData): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    ns.disableLog('ALL');

    const flags = ns.flags([['help', false], ...MEM_TAG_FLAGS]);

    const rest = flags._ as string[];
    if (rest.length === 0 || flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()} SERVER_NAME

Launch as many grow and weaken threads as needed to maximize money
of SERVER_NAME while keeping security at a minimum.

Example:
> run ${ns.getScriptName()} n00dles

OPTIONS
--help           Show this help message
`);
        return;
    }

    const allocationId = await parseAndRegisterAlloc(ns, flags);
    if (flags[ALLOC_ID] !== -1 && allocationId === null) {
        return;
    }

    const target = rest[0];
    if (typeof target !== 'string' || !ns.serverExists(target)) {
        ns.printf('target %s does not exist', target);
        return;
    }

    const taskSelectorClient = new TaskSelectorClient(ns);

    let sowBatchLogistics = calculateSowBatchLogistics(ns, target);
    const { batchRam, totalBatches } = sowBatchLogistics;

    const memClient = new GrowableMemoryClient(ns);
    const allocOptions = { coreDependent: true, shrinkable: true };
    const allocation = await memClient.requestGrowableAllocation(
        batchRam,
        totalBatches,
        allocOptions,
    );
    if (!allocation) {
        ns.print('ERROR: failed to allocate memory for sow batches');
        return;
    }
    allocation.releaseAtExit(ns);
    allocation.startPolling(true);

    // Send a Sow Heartbeat to indicate we're starting the main loop
    taskSelectorClient.tryHeartbeat(
        ns.pid,
        ns.getScriptName(),
        target,
        Lifecycle.Sow,
    );

    let nextHeartbeat =
        Date.now() + CONFIG.heartbeatCadence + Math.random() * 500;
    let round = 0;
    let growNeeded = neededGrowThreads(ns, target);

    while (growNeeded > 0) {
        round += 1;

        const hosts = allocation.allocatedChunks;
        const pids: number[] = [];

        sowBatchLogistics = calculateSowBatchLogistics(ns, target);
        const growPerBatch = sowBatchLogistics.phases[0].threads;

        growNeeded = neededGrowThreads(ns, target);

        const roundsRemaining = Math.ceil(
            growNeeded / (growPerBatch * allocation.numChunks),
        );
        const totalRounds = round - 1 + roundsRemaining;
        const info: RoundInfo = calculateRoundInfo(
            ns,
            target,
            round,
            totalRounds,
            roundsRemaining,
        );

        for (const host of hosts) {
            const ps = await spawnBatch(
                ns,
                host,
                target,
                sowBatchLogistics.phases,
                -1,
                allocation.allocationId,
            );
            pids.push(...ps);
            printRoundProgress(ns, info);
            await ns.asleep(sowBatchLogistics.endingPeriod);
        }

        const sendHb = () =>
            Promise.resolve(
                taskSelectorClient.tryHeartbeat(
                    ns.pid,
                    ns.getScriptName(),
                    target,
                    Lifecycle.Sow,
                ),
            );
        nextHeartbeat = await awaitRound(ns, pids, info, nextHeartbeat, sendHb);

        growNeeded = neededGrowThreads(ns, target);
    }

    await allocation.release(ns);
    ns.toast(`finished sowing ${target}!`, 'success');
    taskSelectorClient.finishedSowing(target);
}

function neededGrowThreads(ns: NS, target: string) {
    const maxMoney = ns.getServerMaxMoney(target);
    const currentMoney = ns.getServerMoneyAvailable(target);

    const totalGrowThreads = growthAnalyze(ns, target, maxMoney, currentMoney);
    return totalGrowThreads;
}

function weakenAnalyze(weakenAmount: number): number {
    if (weakenAmount <= 0) return 0;

    return Math.ceil(weakenAmount * 20) + 1;
}

function weakenAnalyzeSecurity(weakenThreads: number) {
    return -0.05 * weakenThreads;
}

interface SowBatchLogistics extends BatchLogistics {
    totalBatches: number;
}

function calculateSowBatchLogistics(ns: NS, target: string): SowBatchLogistics {
    const threads = calculateMinimalSowBatch(ns);
    const perfectRatioGrowThreads = threads.growThreads;

    const gRam = ns.getScriptRam('/batch/g.js', 'home') * threads.growThreads;
    const wRam = ns.getScriptRam('/batch/w.js', 'home') * threads.weakenThreads;
    const batchRam = gRam + wRam;

    const totalGrowThreads = neededGrowThreads(ns, target);
    const batchGrowThreads = Math.min(
        perfectRatioGrowThreads,
        totalGrowThreads,
    );

    const totalBatches = Math.ceil(totalGrowThreads / batchGrowThreads);

    threads.growThreads = batchGrowThreads;
    const phases = calculateSowPhases(ns, target, threads);

    const batchTime = ns.getWeakenTime(target);
    const endingPeriod = CONFIG.batchInterval * 3;

    const overlap = Math.min(Math.ceil(batchTime / endingPeriod), totalBatches);
    const requiredRam = batchRam * overlap;

    return {
        target,
        totalBatches,
        batchRam,
        overlap,
        endingPeriod,
        requiredRam,
        phases,
    };
}

interface SowThreads {
    growThreads: number;
    weakenThreads: number;
}

function calculateSowPhases(
    ns: NS,
    target: string,
    threads: SowThreads,
): BatchPhase[] {
    const growTime = ns.getGrowTime(target);
    const weakenTime = ns.getWeakenTime(target);
    const phases: BatchPhase[] = [
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
            threads: threads.weakenThreads,
        },
    ];
    return calculatePhaseStartTimes(phases);
}

function calculateMinimalSowBatch(ns: NS) {
    const growSecDelta = ns.growthAnalyzeSecurity(1);
    const weakenSecDelta = -weakenAnalyzeSecurity(1);

    if (growSecDelta == weakenSecDelta) {
        return { growThreads: 1, weakenThreads: 1 };
    } else if (growSecDelta > weakenSecDelta) {
        const weakenPerGrow = Math.ceil(growSecDelta / weakenSecDelta);
        return { growThreads: 1, weakenThreads: weakenPerGrow };
    } else {
        const growPerWeaken = Math.floor(weakenSecDelta / growSecDelta);
        return { growThreads: growPerWeaken, weakenThreads: 1 };
    }
}

function calculateSowBatchThreads(ns: NS, growThreads: number) {
    const growSecDelta = ns.growthAnalyzeSecurity(growThreads);
    const weakenThreads = weakenAnalyze(growSecDelta);
    return { growThreads, weakenThreads };
}

/** Calculate the grow and weaken thread counts required to fully
 *  "sow" the given target server.
 */
export function calculateSowThreads(
    ns: NS,
    target: string,
): { growThreads: number; weakenThreads: number } {
    const growThreads = neededGrowThreads(ns, target);
    return calculateSowBatchThreads(ns, growThreads);
}
