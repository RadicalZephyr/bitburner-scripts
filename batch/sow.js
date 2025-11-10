import { parseFlags } from 'util/flags';
import { calculatePhaseStartTimes, spawnBatch, } from 'services/batch';
import { GrowableMemoryClient } from 'services/client/growable_memory';
import { CONFIG } from 'batch/config';
import { awaitRound, calculateRoundInfo, printRoundProgress, } from 'batch/progress';
import { TaskSelectorClient, Lifecycle } from 'batch/client/task_selector';
import { growthAnalyze } from 'util/growthAnalyze';
const FLAGS = [['help', false]];
export function autocomplete(data) {
    data.flags(FLAGS);
    return data.servers;
}
export async function main(ns) {
    const flags = await parseFlags(ns, FLAGS);
    ns.disableLog('ALL');
    const rest = flags._;
    if (rest.length === 0 || flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()} SERVER_NAME

Launch as many grow and weaken threads as needed to maximize money
of SERVER_NAME while keeping security at a minimum.

Example:
> run ${ns.getScriptName()} n00dles

OPTIONS
--help           Show this help message

CONFIGURATION
  BATCH_heartbeatCadence  Interval between heartbeat messages
  BATCH_batchInterval     Time between batch phases
`);
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
    const allocation = await memClient.requestGrowableAllocation(batchRam, totalBatches, allocOptions);
    if (!allocation) {
        ns.print('ERROR: failed to allocate memory for sow batches');
        return;
    }
    allocation.releaseAtExit(ns);
    void allocation.startPolling(true);
    // Send a Sow Heartbeat to indicate we're starting the main loop
    taskSelectorClient.tryHeartbeat(ns.pid, ns.getScriptName(), target, Lifecycle.Sow);
    let nextHeartbeat = Date.now() + CONFIG.heartbeatCadence + Math.random() * 500;
    let round = 0;
    let growNeeded = neededGrowThreads(ns, target);
    while (growNeeded > 0) {
        round += 1;
        const hosts = allocation.allocatedChunks;
        const pids = [];
        sowBatchLogistics = calculateSowBatchLogistics(ns, target);
        const growPerBatch = sowBatchLogistics.phases[0].threads;
        growNeeded = neededGrowThreads(ns, target);
        const roundsRemaining = Math.ceil(growNeeded / (growPerBatch * allocation.numChunks));
        const totalRounds = round - 1 + roundsRemaining;
        const info = calculateRoundInfo(ns, target, round, totalRounds, roundsRemaining);
        for (const host of hosts) {
            const ps = await spawnBatch(ns, host, target, sowBatchLogistics.phases, -1, allocation.allocationId);
            pids.push(...ps);
            printRoundProgress(ns, info);
            await ns.asleep(sowBatchLogistics.endingPeriod);
        }
        const sendHb = () => Promise.resolve(taskSelectorClient.tryHeartbeat(ns.pid, ns.getScriptName(), target, Lifecycle.Sow));
        nextHeartbeat = await awaitRound(ns, pids, info, nextHeartbeat, sendHb);
        growNeeded = neededGrowThreads(ns, target);
    }
    await allocation.release(ns);
    ns.toast(`finished sowing ${target}!`, 'success');
    void taskSelectorClient.finishedSowing(target);
}
function neededGrowThreads(ns, target) {
    const maxMoney = ns.getServerMaxMoney(target);
    const currentMoney = ns.getServerMoneyAvailable(target);
    const totalGrowThreads = growthAnalyze(ns, target, maxMoney, currentMoney);
    return totalGrowThreads;
}
function weakenAnalyze(weakenAmount) {
    if (weakenAmount <= 0)
        return 0;
    return Math.ceil(weakenAmount * 20) + 1;
}
function weakenAnalyzeSecurity(weakenThreads) {
    return -0.05 * weakenThreads;
}
function calculateSowBatchLogistics(ns, target) {
    const threads = calculateMinimalSowBatch(ns);
    const perfectRatioGrowThreads = threads.growThreads;
    const gRam = ns.getScriptRam('/batch/g.js', 'home') * threads.growThreads;
    const wRam = ns.getScriptRam('/batch/w.js', 'home') * threads.weakenThreads;
    const batchRam = gRam + wRam;
    const totalGrowThreads = neededGrowThreads(ns, target);
    const batchGrowThreads = Math.min(perfectRatioGrowThreads, totalGrowThreads);
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
function calculateSowPhases(ns, target, threads) {
    const growTime = ns.getGrowTime(target);
    const weakenTime = ns.getWeakenTime(target);
    const phases = [
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
function calculateMinimalSowBatch(ns) {
    const growSecDelta = ns.growthAnalyzeSecurity(1);
    const weakenSecDelta = -weakenAnalyzeSecurity(1);
    if (growSecDelta == weakenSecDelta) {
        return { growThreads: 1, weakenThreads: 1 };
    }
    else if (growSecDelta > weakenSecDelta) {
        const weakenPerGrow = Math.ceil(growSecDelta / weakenSecDelta);
        return { growThreads: 1, weakenThreads: weakenPerGrow };
    }
    else {
        const growPerWeaken = Math.floor(weakenSecDelta / growSecDelta);
        return { growThreads: growPerWeaken, weakenThreads: 1 };
    }
}
function calculateSowBatchThreads(ns, growThreads) {
    const growSecDelta = ns.growthAnalyzeSecurity(growThreads);
    const weakenThreads = weakenAnalyze(growSecDelta);
    return { growThreads, weakenThreads };
}
/** Calculate the grow and weaken thread counts required to fully
 *  "sow" the given target server.
 */
export function calculateSowThreads(ns, target) {
    const growThreads = neededGrowThreads(ns, target);
    return calculateSowBatchThreads(ns, growThreads);
}
