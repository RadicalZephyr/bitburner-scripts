import type { AutocompleteData, NS } from "netscript";

import { HostAllocation, MemoryClient, registerAllocationOwnership } from "services/client/memory";

import { CONFIG } from "batch/config";
import {
    analyzeBatchThreads,
    BatchThreadAnalysis,
    hackThreadsForPercent,
} from "batch/expected_value";


export function autocomplete(data: AutocompleteData, _args: string[]): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    ns.disableLog('ALL');

    const flags = ns.flags([
        ['allocation-id', -1],
        ['max-ram', -1],
        ['help', false],
    ]);

    const rest = flags._ as string[];
    if (rest.length === 0 || flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()} SERVER_NAME

Continually harvest money from the target with batches of
hack/weaken/grow/weaken scripts. Thread counts for each type of script
are calculated to maintain the target at maximum money and minimum
security.

Example:
> run ${ns.getScriptName()} n00dles

OPTIONS
--help           Show this help message
--max-ram        Limit RAM usage per batch run
`);
        return;
    }

    let allocationId = flags['allocation-id'];
    if (allocationId !== -1) {
        if (typeof allocationId !== 'number') {
            ns.tprint('--allocation-id must be a number');
            return;
        }
        registerAllocationOwnership(ns, allocationId, "self");
    }

    let maxRam = flags['max-ram'];
    if (maxRam !== -1) {
        if (typeof maxRam !== 'number' || maxRam <= 0) {
            ns.tprint('--max-ram must be a positive number');
            return;
        }
    }

    let target = rest[0];
    if (typeof target !== 'string' || !ns.serverExists(target)) {
        ns.tprintf("target %s does not exist", target);
        return;
    }

    let hackPercent = maxRam !== -1
        ? maxHackPercentForRam(ns, target, maxRam)
        : 0.25;

    let logistics = calculateBatchLogistics(ns, target, hackPercent);
    let overlapLimit = logistics.overlap;
    if (maxRam !== -1) {
        overlapLimit = Math.min(overlapLimit, Math.floor(maxRam / logistics.batchRam));
    }
    if (overlapLimit < 1) {
        ns.tprint(`max-ram ${ns.formatRam(maxRam)} is too small for one batch`);
        return;
    }

    const requiredRam = logistics.batchRam * overlapLimit;
    ns.printf(
        `%s: batch ram %s, overlap x%d => required %s\nphases: %s`,
        logistics.target,
        ns.formatRam(logistics.batchRam),
        overlapLimit,
        ns.formatRam(requiredRam),
        JSON.stringify(logistics.phases, undefined, 2)
    );

    let memClient = new MemoryClient(ns);
    let allocation = await memClient.requestOwnedAllocation(logistics.batchRam, overlapLimit);
    if (!allocation) return;

    // Track how many batches can overlap concurrently. If the
    // calculated overlap drops we release the extra memory back to the
    // MemoryManager so it can be reused by other processes.
    let maxOverlap = overlapLimit;
    let currentBatches = 0;

    let batchHost: SparseHostArray = makeBatchHostArray(allocation);

    let batches = [];
    // Launch one batch per allocated chunk so that the pipeline is
    // fully populated before entering the steady state loop.
    for (let i = 0; i < maxOverlap; ++i) {
        const host = batchHost.at(i);
        let batchPids = spawnBatch(ns, host, target, logistics.phases);
        batches.push(batchPids);
        currentBatches++;
        await ns.sleep(CONFIG.batchInterval);
    }

    while (true) {
        let logistics = calculateBatchLogistics(ns, target, hackPercent);

        const desiredOverlap = Math.min(overlapLimit, logistics.overlap);

        if (desiredOverlap < maxOverlap) {
            const toRelease = maxOverlap - desiredOverlap;
            ns.print(`necessary overlap is decreasing! could have released ${toRelease} chunks...`);
        }
        let batchIndex = currentBatches % maxOverlap;
        const host = batchHost.at(batchIndex);
        let lastScriptPid = batches[batchIndex].at(-1);
        if (typeof lastScriptPid === "number") {
            while (ns.isRunning(lastScriptPid)) {
                await ns.sleep(10);
            }
        }
        let batchPids = spawnBatch(ns, host, target, logistics.phases);
        if (batchPids.length > 0) {
            batches[batchIndex] = batchPids;
            currentBatches++;
        }

        if (currentBatches > maxOverlap) {
            currentBatches = currentBatches % maxOverlap;
        }
        await ns.sleep(CONFIG.batchInterval);
    }
}

interface SparseHostEntry {
    start: number;
    end: number;
    hostname: string;
}

class SparseHostArray {
    private intervals: SparseHostEntry[];

    constructor() {
        this.intervals = [];
    }

    at(i: number): string | null {
        let low = 0;
        let high = this.intervals.length - 1;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const int = this.intervals[mid];
            if (i < int.start) {
                high = mid - 1;
            } else if (i >= int.end) {
                low = mid + 1;
            } else {
                return int.hostname;
            }
        }
        return undefined;
    }

    pushN(hostname: string, n: number) {
        let lastEntry = this.intervals.at(-1);

        if (lastEntry?.hostname === hostname) {
            lastEntry.end += n;
        } else {
            let start = lastEntry ? lastEntry.end : 0;
            this.intervals.push({ hostname, start, end: start + n });
        }
    }
}

function makeBatchHostArray(allocatedChunks: HostAllocation[]) {
    let sparseHosts = new SparseHostArray();

    for (const chunk of allocatedChunks) {
        sparseHosts.pushN(chunk.hostname, chunk.numChunks);
    }

    return sparseHosts;
}

function spawnBatch(ns: NS, host: string | null, target: string, phases: BatchPhase[]): number[] {
    if (!host) return [];

    const scripts = Array.from(new Set(phases.map(p => `/batch/${p.script}`)));
    ns.scp(scripts, host, "home");

    let pids = [];
    for (const phase of phases) {
        if (phase.threads <= 0) continue;
        const script = `/batch/${phase.script}`;
        const pid = ns.exec(script, host, phase.threads, target, phase.start);
        if (pid === 0) {
            ns.print(`WARN: failed to spawn ${script} on ${host}`);
        } else {
            pids.push(pid);
        }
    }
    return pids;
}

export interface BatchLogistics {
    target: string;
    batchRam: number;
    overlap: number;
    requiredRam: number;
    phases: BatchPhase[];
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
    const hackThreads = hackPercent !== undefined
        ? hackThreadsForPercent(ns, target, hackPercent)
        : 1;
    const threads = analyzeBatchThreads(ns, target, hackThreads);

    const phases = calculateBatchPhases(ns, target, threads);

    const hRam = ns.getScriptRam('/batch/h.js', "home") * threads.hackThreads;
    const gRam = ns.getScriptRam('/batch/g.js', "home") * threads.growThreads;
    const wRam = ns.getScriptRam('/batch/w.js', "home") *
        (threads.postHackWeakenThreads + threads.postGrowWeakenThreads);
    const batchRam = hRam + gRam + wRam;

    const batchTime = ns.getWeakenTime(target) + 2 * (CONFIG.batchInterval as number);
    const baseNetscriptOperationTime = 20;
    const batchEndingPeriod = (baseNetscriptOperationTime + CONFIG.batchInterval) * 4;
    const overlap = Math.ceil(batchTime / batchEndingPeriod);
    const requiredRam = batchRam * overlap;

    return {
        target,
        batchRam,
        overlap,
        requiredRam,
        phases,
    }
}

interface BatchPhase {
    script: string;
    start: number;
    duration: number;
    threads: number;
}

/** Calculate the phase order and relative start times for a full
 * H-W-G-W batch so that each script ends `CONFIG.batchInterval`
 * milliseconds after the previous one.
 */
export function calculateBatchPhases(ns: NS, target: string, threads: BatchThreadAnalysis): BatchPhase[] {
    const spacing = CONFIG.batchInterval as number;

    const hackTime = ns.getHackTime(target);
    const weakenTime = ns.getWeakenTime(target);
    const growTime = ns.getGrowTime(target);

    const phases: BatchPhase[] = [
        { script: "h.js", start: 0, duration: hackTime, threads: threads.hackThreads },
        { script: "w.js", start: 0, duration: weakenTime, threads: threads.postHackWeakenThreads },
        { script: "g.js", start: 0, duration: growTime, threads: threads.growThreads },
        { script: "w.js", start: 0, duration: weakenTime, threads: threads.postGrowWeakenThreads },
    ];

    let endTime = 0;
    for (const p of phases) {
        p.start = endTime - p.duration;
        endTime += spacing;
    }

    // Get relative end time of final instance
    // N.B. subtract one spacing to account for final loop increment
    const relativeBatchEnd = endTime - spacing;

    // Determine offset to bring most negative start time to zero
    let earliestStart = Math.abs(Math.min(...phases.map(p => p.start)));

    // Push forward all start times so earliest one is zero
    for (const p of phases) {
        p.start += earliestStart;
    }

    return phases;
}

function maxHackPercentForRam(ns: NS, target: string, maxRam: number): number {
    let low = 0;
    let high = 0.25;
    for (let i = 0; i < 16; i++) {
        const mid = (low + high) / 2;
        const { batchRam, overlap } = calculateBatchLogistics(ns, target, mid);
        if (batchRam * overlap <= maxRam) {
            low = mid;
        } else {
            high = mid;
        }
    }
    return low;
}
