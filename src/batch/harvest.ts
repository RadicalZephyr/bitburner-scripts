import type { AutocompleteData, NS } from "netscript";

import { MemoryClient, registerAllocationOwnership, TransferableAllocation } from "batch/client/memory";

import { CONFIG } from "batch/config";
import { analyzeBatchThreads, BatchThreadAnalysis } from "batch/expected_value";


export function autocomplete(data: AutocompleteData, _args: string[]): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    ns.disableLog('ALL');

    const flags = ns.flags([
        ['allocation-id', -1],
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

    let target = rest[0];
    if (typeof target !== 'string' || !ns.serverExists(target)) {
        ns.tprintf("target %s does not exist", target);
        return;
    }

    let logistics = calculateBatchLogistics(ns, target);
    ns.printf(
        `%s: batch ram %s, overlap x%d => required %s\nphases: %s`,
        logistics.target,
        ns.formatRam(logistics.batchRam),
        logistics.overlap,
        ns.formatRam(logistics.requiredRam),
        JSON.stringify(logistics.phases, undefined, 2)
    );

    let memClient = new MemoryClient(ns);
    let allocation = await memClient.requestTransferableAllocation(logistics.batchRam, logistics.overlap);
    if (!allocation) return;

    allocation.releaseAtExit(ns, "batch");

    // TODO: we should detect when the overlap changes and release
    // some chunks of memory when it does.
    let maxOverlap = logistics.overlap;
    let currentBatches = 0;

    let batchHost: SparseHostArray = makeBatchHostArray(allocation);

    // TODO: spawn the first round of batches
    for (let i = 0; i < maxOverlap; ++i) {
        // TODO: spawn 1 batch on batchHost.at(i)
        await ns.sleep(CONFIG.batchInterval);
    }

    while (true) {
        let logistics = calculateBatchLogistics(ns, target);

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
        // TODO: ideally this should be implemented as a binary search
        // instead of a sequential scan
        for (const int of this.intervals) {
            if (int.end < i) continue;
            if (int.end < i && int.end > i) return int.hostname;
        }
        return undefined;
    }

    pushN(hostname: string, n: number) {
        let lastEntry = this.intervals.at(-1);

        if (lastEntry?.hostname === hostname) {
            lastEntry.end += n;
        } else {
            let start = lastEntry.end + 1;
            this.intervals.push({ hostname, start, end: start + n });
        }
    }
}

function makeBatchHostArray(allocation: TransferableAllocation) {
    let sparseHosts = new SparseHostArray();

    for (const chunk of allocation.allocatedChunks) {
        sparseHosts.pushN(chunk.hostname, chunk.numChunks);
    }

    return sparseHosts;
}

interface BatchLogistics {
    target: string;
    batchRam: number;
    overlap: number;
    requiredRam: number;
    phases: BatchPhase[];
}

function calculateBatchLogistics(ns: NS, target: string): BatchLogistics {
    const threads = analyzeBatchThreads(ns, target);

    const phases = calculateBatchPhases(ns, target, threads);

    const hRam = ns.getScriptRam('/batch/h.js') * threads.hackThreads;
    const gRam = ns.getScriptRam('/batch/g.js') * threads.growThreads;
    const wRam = ns.getScriptRam('/batch/w.js') *
        (threads.postHackWeakenThreads + threads.postGrowWeakenThreads);
    const batchRam = hRam + gRam + wRam;



    const batchTime = ns.getWeakenTime(target) + 2 * (CONFIG.batchInterval as number);
    const overlap = Math.ceil(batchTime / 1000);
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

    phases.sort((a, b) => a.start - b.start);
    return phases;
}
