import type { AutocompleteData, NS } from "netscript";

import { TaskSelectorClient, Lifecycle } from "batch/client/task_selector";

import { registerAllocationOwnership, MemoryClient } from "services/client/memory";

import { CONFIG } from "batch/config";
import { awaitRound, calculateRoundInfo, RoundInfo } from "batch/progress";

import { BatchLogistics, BatchPhase, calculatePhaseStartTimes, spawnBatch } from "services/batch";

const GROW_SCRIPT = "/batch/g.js";
const WEAKEN_SCRIPT = "/batch/w.js";

export function autocomplete(data: AutocompleteData, _args: string[]): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    ns.disableLog('ALL');

    const flags = ns.flags([
        ['allocation-id', -1],
        ['max-threads', -1],
        ['help', false],
    ]);

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
--max-threads    Cap the number of threads spawned
`);
        return;
    }

    let allocationId = flags['allocation-id'];
    if (allocationId !== -1) {
        if (typeof allocationId !== 'number') {
            ns.tprint('--allocation-id must be a number');
            return;
        }
        await registerAllocationOwnership(ns, allocationId, "self");
    }

    let maxThreads = flags['max-threads'];
    if (maxThreads !== -1) {
        if (typeof maxThreads !== 'number' || maxThreads <= 0) {
            ns.tprint('--max-threads must be a positive number');
            return;
        }
    }

    let target = rest[0];
    if (typeof target !== 'string' || !ns.serverExists(target)) {
        ns.tprintf("target %s does not exist", target);
        return;
    }

    let taskSelectorClient = new TaskSelectorClient(ns);

    let totalGrowThreads = neededGrowThreads(ns, target);
    if (totalGrowThreads < 1) {
        ns.printf(`no need to sow ${target}`);
        ns.toast(`finished sowing ${target}!`, "success");
        taskSelectorClient.finishedSowing(target);
        return;
    }

    const sowBatchLogistics = calculateSowBatchLogistics(ns, target);
    const { batchRam, overlap } = sowBatchLogistics;

    let allocChunks = overlap;
    if (maxThreads !== -1) {
        const batchThreads = sowBatchLogistics.phases.reduce((s, p) => s + p.threads, 0);
        allocChunks = Math.min(overlap, Math.floor(maxThreads / batchThreads));
        if (allocChunks === 0) {
            ns.tprint('--max-threads is too small for one batch');
            return;
        }
    }
    // let weakenThreads: number;
    // if (maxThreads !== -1) {
    //     growThreads = Math.min(growThreads, maxThreads);
    //     ({ weakenThreads } = calculateSowThreadsForMaxThreads(ns, growThreads));
    // } else {
    //     let growSecDelta = ns.growthAnalyzeSecurity(growThreads, target);
    //     weakenThreads = weakenAnalyze(growSecDelta);
    // }

    const memClient = new MemoryClient(ns);

    const allocOptions = { coreDependent: true, shrinkable: true };
    let alloc = await memClient.requestTransferableAllocation(batchRam, allocChunks, allocOptions);

    // Send a Sow Heartbeat to indicate we're starting the main loop
    taskSelectorClient.tryHeartbeat(ns.pid, ns.getScriptName(), target, Lifecycle.Sow);

    const hosts: string[] = [];
    for (const chunk of alloc.allocatedChunks) {
        for (let i = 0; i < chunk.numChunks; i++) {
            hosts.push(chunk.hostname);
        }
    }

    const maxOverlap = hosts.length;
    const totalBatches = maxOverlap;
    let totalGrowBatches = sowBatchLogistics.totalBatches;

    const growPhase = sowBatchLogistics.phases.find(p => p.script === GROW_SCRIPT)!;
    const growThreadsPerBatch = growPhase.threads;

    let round = 0;
    let nextHeartbeat = Date.now() + CONFIG.heartbeatCadence + Math.random() * 500;

    while (totalGrowThreads > 0) {
        round += 1;
        const roundsRemaining = Math.ceil(totalGrowBatches / totalBatches);
        const totalRounds = (round - 1) + roundsRemaining;

        const info: RoundInfo = calculateRoundInfo(ns, target, round, totalRounds, roundsRemaining);

        const batchesThisRound = Math.min(maxOverlap, totalGrowBatches);
        let pids: number[] = [];
        for (let i = 0; i < batchesThisRound; i++) {
            const host = hosts[i];
            const batchPids = await spawnBatch(ns, host, target, sowBatchLogistics.phases, -1, alloc.allocationId);
            pids = pids.concat(batchPids);
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

        totalGrowThreads = neededGrowThreads(ns, target);
        totalGrowBatches = Math.ceil(totalGrowThreads / growThreadsPerBatch);
    }

    await alloc.release(ns);
    ns.toast(`finished sowing ${target}!`, "success");
    taskSelectorClient.finishedSowing(target);
}

function calculateSowThreadsForMaxThreads(ns: NS, maxThreads: number) {
    let low = 1;
    let high = maxThreads;
    for (let i = 0; i < 16; i++) {
        const mid = Math.floor((low + high) / 2);
        const { growThreads, weakenThreads } = calculateSowBatchThreads(ns, mid);
        if (growThreads + weakenThreads === maxThreads) {
            low = mid;
            break;
        } else if (growThreads + weakenThreads < maxThreads) {
            low = mid;
        } else {
            high = mid;
        }
    }
    return calculateSowBatchThreads(ns, low);
}


function neededGrowThreads(ns: NS, target: string) {
    const maxMoney = ns.getServerMaxMoney(target);
    const currentMoney = ns.getServerMoneyAvailable(target);

    const neededGrowRatio = currentMoney > 0 ? maxMoney / currentMoney : maxMoney;
    const totalGrowThreads = growthAnalyze(ns, target, neededGrowRatio);
    return totalGrowThreads;
}

/** Calculate the number of threads needed to build the server by a
 *  certain multiplier. The result accounts for the player's grow
 *  thread multiplier.
 */
function growthAnalyze(ns: NS, target: string, growAmount: number): number {
    if (growAmount <= 0) return 0;

    return Math.ceil(ns.growthAnalyze(target, growAmount, 1));
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

    const gRam = ns.getScriptRam('/batch/g.js', "home") * threads.growThreads;
    const wRam = ns.getScriptRam('/batch/w.js', "home") * threads.weakenThreads;
    const batchRam = gRam + wRam;

    const totalGrowThreads = neededGrowThreads(ns, target);
    const totalBatches = Math.ceil(totalGrowThreads / threads.growThreads);

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
        phases
    };
}

interface SowThreads {
    growThreads: number;
    weakenThreads: number;
}

function calculateSowPhases(ns: NS, target: string, threads: SowThreads): BatchPhase[] {
    const growTime = ns.getGrowTime(target);
    const weakenTime = ns.getWeakenTime(target);
    const phases: BatchPhase[] = [
        { script: "/batch/g.js", start: 0, duration: growTime, threads: threads.growThreads },
        { script: "/batch/w.js", start: 0, duration: weakenTime, threads: threads.weakenThreads }
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
export function calculateSowThreads(ns: NS, target: string): { growThreads: number; weakenThreads: number } {
    const growThreads = neededGrowThreads(ns, target);
    return calculateSowBatchThreads(ns, growThreads);
}
