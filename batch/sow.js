import { TaskSelectorClient, Lifecycle } from "batch/client/task_selector";
import { registerAllocationOwnership, MemoryClient, } from "services/client/memory";
import { CONFIG } from "batch/config";
import { awaitRound, calculateRoundInfo } from "batch/progress";
const GROW_SCRIPT = "/batch/g.js";
const WEAKEN_SCRIPT = "/batch/w.js";
export function autocomplete(data, _args) {
    return data.servers;
}
export async function main(ns) {
    ns.disableLog('ALL');
    const flags = ns.flags([
        ['allocation-id', -1],
        ['max-threads', -1],
        ['help', false],
    ]);
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
    let growThreads = neededGrowThreads(ns, target);
    let weakenThreads;
    if (maxThreads !== -1) {
        growThreads = Math.min(growThreads, maxThreads);
        ({ weakenThreads } = calculateSowThreadsForMaxThreads(ns, growThreads));
    }
    else {
        let growSecDelta = ns.growthAnalyzeSecurity(growThreads, target);
        weakenThreads = weakenAnalyze(growSecDelta);
    }
    if (growThreads < 1 || weakenThreads < 1) {
        ns.printf(`no need to sow ${target}`);
        ns.toast(`finished sowing ${target}!`, "success");
        taskSelectorClient.finishedSowing(target);
        return;
    }
    const memClient = new MemoryClient(ns);
    const wRam = ns.getScriptRam(WEAKEN_SCRIPT, "home");
    const gRam = ns.getScriptRam(GROW_SCRIPT, "home");
    const allocOptions = { coreDependent: true, shrinkable: true };
    let weakenAlloc = await memClient.requestTransferableAllocation(wRam, weakenThreads, allocOptions);
    if (!weakenAlloc) {
        ns.tprint("ERROR: failed to allocate memory for weaken threads");
        return;
    }
    let growAlloc = await memClient.requestTransferableAllocation(gRam, growThreads, allocOptions);
    if (!growAlloc) {
        ns.tprint("ERROR: failed to allocate memory for grow threads");
        return;
    }
    // Send a Sow Heartbeat to indicate we're starting the main loop
    await taskSelectorClient.heartbeat(ns.pid, ns.getScriptName(), target, Lifecycle.Sow);
    let totalGrowThreads = neededGrowThreads(ns, target);
    const totalThreads = growAlloc.numChunks;
    let round = 0;
    let nextHeartbeat = Date.now() + CONFIG.heartbeatCadence + Math.random() * 500;
    while (growThreads > 0) {
        round += 1;
        const roundsRemaining = Math.ceil(totalGrowThreads / totalThreads);
        const totalRounds = (round - 1) + roundsRemaining;
        const info = calculateRoundInfo(ns, target, round, totalRounds, roundsRemaining);
        const growPids = runAllocation(ns, growAlloc, GROW_SCRIPT, growThreads, target, 0);
        const weakenPids = runAllocation(ns, weakenAlloc, WEAKEN_SCRIPT, weakenThreads, target, 0);
        const pids = [...growPids, ...weakenPids];
        const sendHb = () => Promise.resolve(taskSelectorClient.tryHeartbeat(ns.pid, ns.getScriptName(), target, Lifecycle.Sow));
        nextHeartbeat = await awaitRound(ns, pids, info, nextHeartbeat, sendHb);
        totalGrowThreads = neededGrowThreads(ns, target);
        growThreads = Math.min(totalGrowThreads, growThreads);
        const growSec = ns.growthAnalyzeSecurity(growThreads, target);
        weakenThreads = Math.min(weakenAnalyze(growSec), weakenThreads);
    }
    await weakenAlloc.release(ns);
    await growAlloc.release(ns);
    ns.toast(`finished sowing ${target}!`, "success");
    taskSelectorClient.finishedSowing(target);
}
function calculateSowThreadsForMaxThreads(ns, maxThreads) {
    let low = 1;
    let high = maxThreads;
    for (let i = 0; i < 16; i++) {
        const mid = Math.floor((low + high) / 2);
        const { growThreads, weakenThreads } = calculateSowBatchThreads(ns, mid);
        if (growThreads + weakenThreads === maxThreads) {
            low = mid;
            break;
        }
        else if (growThreads + weakenThreads < maxThreads) {
            low = mid;
        }
        else {
            high = mid;
        }
    }
    return calculateSowBatchThreads(ns, low);
}
function calculateSowBatchThreads(ns, growThreads) {
    const growSecDelta = ns.growthAnalyzeSecurity(growThreads);
    const weakenThreads = weakenAnalyze(growSecDelta);
    return { growThreads, weakenThreads };
}
function runAllocation(ns, allocation, script, threads, ...args) {
    let remaining = threads;
    let pids = [];
    for (const chunk of allocation.allocatedChunks) {
        if (remaining <= 0)
            break;
        const t = Math.min(chunk.numChunks, remaining);
        ns.scp(script, chunk.hostname, "home");
        const pid = ns.exec(script, chunk.hostname, { threads: t, temporary: true }, ...args);
        if (pid === 0) {
            ns.print(`WARN: failed to exec ${script} on ${chunk.hostname}`);
        }
        else {
            pids.push(pid);
        }
        remaining -= t;
    }
    return pids;
}
function neededGrowThreads(ns, target) {
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
function growthAnalyze(ns, target, growAmount) {
    if (growAmount <= 0)
        return 0;
    return Math.ceil(ns.growthAnalyze(target, growAmount, 1));
}
function weakenAnalyze(weakenAmount) {
    if (weakenAmount <= 0)
        return 0;
    return Math.ceil(weakenAmount * 20) + 1;
}
/** Calculate the grow and weaken thread counts required to fully
 *  "sow" the given target server.
 */
export function calculateSowThreads(ns, target) {
    const growThreads = neededGrowThreads(ns, target);
    const growSecDelta = ns.growthAnalyzeSecurity(growThreads, target);
    const weakenThreads = weakenAnalyze(growSecDelta);
    return { growThreads, weakenThreads };
}
