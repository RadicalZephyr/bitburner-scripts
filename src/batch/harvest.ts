import type { NS } from "netscript";

import { registerAllocationOwnership } from "./client/memory";
import { CONFIG } from "batch/config";

interface BatchTimings {
    hackStart: number;
    postHackWeakenStart: number;
    growStart: number;
    postGrowWeakenStart: number;
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

    const timings = calculateBatchTimings(ns, target);
    ns.print(`hack start: ${timings.hackStart}`);
    ns.print(`post-hack weaken start: ${timings.postHackWeakenStart}`);
    ns.print(`grow start: ${timings.growStart}`);
    ns.print(`post-grow weaken start: ${timings.postGrowWeakenStart}`);
}

/** Calculate relative start times for a full H-W-G-W batch so that each
 * script ends `CONFIG.batchInterval` milliseconds after the previous one.
 */
export function calculateBatchTimings(ns: NS, target: string): BatchTimings {
    const spacing = CONFIG.batchInterval as number;
    const alignment = spacing * 5;

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

    const relativeBatchEnd = endTime - spacing;
    let earliestStart = Math.abs(Math.min(...phases.map(p => p.start)));
    let actualEnd = relativeBatchEnd + earliestStart;

    if (actualEnd > alignment) {
        const padding = alignment - (actualEnd % alignment);
        actualEnd += padding;
        earliestStart += padding;
    }

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
