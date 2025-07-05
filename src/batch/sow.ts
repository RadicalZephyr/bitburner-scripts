import type { AutocompleteData, NS, ScriptArg } from "netscript";

import { TaskSelectorClient, Lifecycle } from "batch/client/task_selector";

import {
    registerAllocationOwnership,
    MemoryClient,
    TransferableAllocation,
} from "services/client/memory";

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

    let growThreads = neededGrowThreads(ns, target);
    let weakenThreads: number;
    if (maxThreads !== -1) {
        growThreads = Math.min(growThreads, maxThreads);
        ({ weakenThreads } = calculateSowThreadsForMaxThreads(ns, target, growThreads));
    } else {
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

    let weakenAlloc = await memClient.requestTransferableAllocation(wRam, weakenThreads, false, true, true);

    if (!weakenAlloc) {
        ns.tprint("ERROR: failed to allocate memory for weaken threads");
        return;
    }

    let growAlloc = await memClient.requestTransferableAllocation(gRam, growThreads, false, true, true);

    if (!growAlloc) {
        ns.tprint("ERROR: failed to allocate memory for grow threads");
        return;
    }

    // Send a Sow Heartbeat to indicate we're starting the main loop
    await taskSelectorClient.heartbeat(ns.pid, ns.getScriptName(), target, Lifecycle.Sow);

    let totalGrowThreads = neededGrowThreads(ns, target);
    const totalThreads = growAlloc.allocatedChunks.reduce((s, c) => s + c.numChunks, 0);

    let round = 0;

    while (growThreads > 0) {
        round += 1;
        const roundsRemaining = Math.ceil(totalGrowThreads / totalThreads);
        const totalRounds = (round - 1) + roundsRemaining;

        const roundTime = ns.getWeakenTime(target);
        const roundStart = ns.self().onlineRunningTime * 1000;
        const roundEnd = roundStart + roundTime;
        const totalExpectedEnd = roundStart + (roundsRemaining * roundTime);

        const growPids = runAllocation(ns, growAlloc, GROW_SCRIPT, growThreads, target, 0);
        const weakenPids = runAllocation(ns, weakenAlloc, WEAKEN_SCRIPT, weakenThreads, target, 0);
        const pids = [...growPids, ...weakenPids];

        for (const pid of pids) {
            while (ns.isRunning(pid)) {
                ns.clearLog();
                const elapsed = ns.self().onlineRunningTime * 1000;
                ns.print(`
Round ${round} of ${totalRounds}
Round ends:      ${ns.tFormat(roundEnd)}
Total expected:  ${ns.tFormat(totalExpectedEnd)}
Elapsed time:    ${ns.tFormat(elapsed)}
`);
                await taskSelectorClient.heartbeat(ns.pid, ns.getScriptName(), target, Lifecycle.Sow);
                await ns.sleep(1000);
            }
        }

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

function calculateSowThreadsForMaxThreads(ns: NS, target: string, maxThreads: number) {
    let low = 1;
    let high = maxThreads;
    for (let i = 0; i < 16; i++) {
        const mid = Math.floor((low + high) / 2);
        const { growThreads, weakenThreads } = calculateSowBatchThreads(ns, target, mid);
        if (growThreads + weakenThreads === maxThreads) {
            low = mid;
            break;
        } else if (growThreads + weakenThreads < maxThreads) {
            low = mid;
        } else {
            high = mid;
        }
    }
    return calculateSowBatchThreads(ns, target, low);
}

function calculateSowBatchThreads(ns: NS, target: string, growThreads: number) {
    const growSecDelta = ns.growthAnalyzeSecurity(growThreads);
    const weakenThreads = weakenAnalyze(growSecDelta);
    return { growThreads, weakenThreads };
}

function runAllocation(
    ns: NS,
    allocation: TransferableAllocation,
    script: string,
    threads: number,
    ...args: ScriptArg[]
): number[] {
    let remaining = threads;
    let pids: number[] = [];
    for (const chunk of allocation.allocatedChunks) {
        if (remaining <= 0) break;
        const t = Math.min(chunk.numChunks, remaining);
        ns.scp(script, chunk.hostname, "home");
        const pid = ns.exec(script, chunk.hostname, { threads: t, temporary: true }, ...args);
        if (pid === 0) {
            ns.print(`WARN: failed to exec ${script} on ${chunk.hostname}`);
        } else {
            pids.push(pid);
        }
        remaining -= t;
    }
    return pids;
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

/** Calculate the grow and weaken thread counts required to fully
 *  "sow" the given target server.
 */
export function calculateSowThreads(ns: NS, target: string): { growThreads: number; weakenThreads: number } {
    const growThreads = neededGrowThreads(ns, target);
    const growSecDelta = ns.growthAnalyzeSecurity(growThreads, target);
    const weakenThreads = weakenAnalyze(growSecDelta);
    return { growThreads, weakenThreads };
}
