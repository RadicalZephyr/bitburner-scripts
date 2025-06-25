import type { NS } from "netscript";

import { registerAllocationOwnership } from "./client/memory";
import { CONFIG } from "batch/config";
import { analyzeBatchThreads, BatchThreadAnalysis } from "batch/expected_value";

interface BatchTimings {
    hackStart: number;
    postHackWeakenStart: number;
    growStart: number;
    postGrowWeakenStart: number;
}

interface BatchLogistics {
    target: string;
    batchRam: number;
    overlap: number;
    requiredRam: number;
    threads: BatchThreadAnalysis;
    timings: BatchTimings;
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
    ns.tprintf(
        `%s: batch ram %s, overlap x%d => required %s`,
        logistics.target,
        ns.formatRam(logistics.batchRam),
        logistics.overlap,
        ns.formatRam(logistics.requiredRam),
    );
}

function calculateBatchLogistics(ns: NS, target: string): BatchLogistics {
    const threads = analyzeBatchThreads(ns, target);

    const hRam = ns.getScriptRam('/batch/h.js') * threads.hackThreads;
    const gRam = ns.getScriptRam('/batch/g.js') * threads.growThreads;
    const wRam = ns.getScriptRam('/batch/w.js') *
        (threads.postHackWeakenThreads + threads.postGrowWeakenThreads);
    const batchRam = hRam + gRam + wRam;

    const timings = calculateBatchTimings(ns, target);

    const batchTime = ns.getWeakenTime(target) + 2 * (CONFIG.batchInterval as number);
    const overlap = Math.ceil(batchTime / 1000);
    const requiredRam = batchRam * overlap;

    return {
        target,
        threads,
        timings,
        batchRam,
        overlap,
        requiredRam,
    }
}

/** Calculate relative start times for a full H-W-G-W batch so that each
 * script ends `CONFIG.batchInterval` milliseconds after the previous one.
 */
export function calculateBatchTimings(ns: NS, target: string): BatchTimings {
    const spacing = CONFIG.batchInterval as number;

    const hackTime = ns.getHackTime(target);
    const weakenTime = ns.getWeakenTime(target);
    const growTime = ns.getGrowTime(target);

    const phases = [
        { duration: hackTime, start: 0 },
        { duration: weakenTime, start: 0 },
        { duration: growTime, start: 0 },
        { duration: weakenTime, start: 0 },
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
    const startTimes = [] as number[];
    for (const p of phases) {
        p.start += earliestStart;
        startTimes.push(p.start);
    }

    return {
        hackStart: startTimes[0],
        postHackWeakenStart: startTimes[1],
        growStart: startTimes[2],
        postGrowWeakenStart: startTimes[3],
    };
}
