import type { AutocompleteData, NS, ScriptArg } from "netscript";

import { ManagerClient, Lifecycle } from "batch/client/manage";

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

    let managerClient = new ManagerClient(ns);

    let growThreads = neededGrowThreads(ns, target);
    let weakenThreads: number;
    if (maxThreads !== -1) {
        growThreads = Math.min(growThreads, maxThreads);
        ({ growThreads, weakenThreads } = calculateSowThreadsForMaxThreads(ns, target, growThreads));

    } else {
        let growSecDelta = ns.growthAnalyzeSecurity(growThreads, target);
        weakenThreads = weakenAnalyze(growSecDelta);
    }

    if (growThreads < 1 || weakenThreads < 1) {
        ns.printf(`no need to sow ${target}`);
        ns.toast(`finished sowing ${target}!`, "success");
        managerClient.finishedSowing(target);
        return;
    }

    const memClient = new MemoryClient(ns);

    const wRam = ns.getScriptRam(WEAKEN_SCRIPT, "home");
    const gRam = ns.getScriptRam(GROW_SCRIPT, "home");

    let weakenAlloc: TransferableAllocation | null = null;
    while (!weakenAlloc) {
        weakenAlloc = await memClient.requestTransferableAllocation(wRam, weakenThreads, false, true);
        if (!weakenAlloc) await ns.sleep(1000);
    }

    let growAlloc: TransferableAllocation | null = null;
    while (!growAlloc) {
        growAlloc = await memClient.requestTransferableAllocation(gRam, growThreads, false, true);
        if (!growAlloc) await ns.sleep(1000);
    }

    const expectedTime = ns.tFormat(ns.getWeakenTime(target));

    // Send a Sow Heartbeat to indicate we're starting the main loop
    await managerClient.heartbeat(ns.pid, ns.getScriptName(), target, Lifecycle.Sow);

    let growNeeded = growThreads;
    let weakenNeeded = weakenThreads;

    while (growNeeded > 0) {
        const growPids = runAllocation(ns, growAlloc, GROW_SCRIPT, growNeeded, target, 0);
        const weakenPids = runAllocation(ns, weakenAlloc, WEAKEN_SCRIPT, weakenNeeded, target, 0);
        const pids = [...growPids, ...weakenPids];

        for (const pid of pids) {
            while (ns.isRunning(pid)) {
                ns.clearLog();
                const selfScript = ns.self();
                ns.print(`\nExpected time: ${expectedTime}\nElapsed time:  ${ns.tFormat(selfScript.onlineRunningTime * 1000)}`);
                await managerClient.heartbeat(ns.pid, ns.getScriptName(), target, Lifecycle.Sow);
                await ns.sleep(1000);
            }
        }

        growNeeded = Math.min(neededGrowThreads(ns, target), growThreads);
        const growSec = ns.growthAnalyzeSecurity(growNeeded, target);
        weakenNeeded = Math.min(weakenAnalyze(growSec), weakenThreads);
    }

    await weakenAlloc.release(ns);
    await growAlloc.release(ns);
    ns.toast(`finished sowing ${target}!`, "success");
    managerClient.finishedSowing(target);
}

function calculateSowThreadsForMaxThreads(ns: NS, target: string, maxThreads: number) {
    let low = 0;
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
    const growSecDelta = ns.growthAnalyzeSecurity(growThreads, target);
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
        const pid = ns.exec(script, chunk.hostname, t, ...args);
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
