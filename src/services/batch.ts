import type { NS } from "netscript";

import { CONFIG } from "batch/config";

import { AllocationChunk } from "services/client/memory";
import { TAG_ARG } from "services/client/memory_tag";

import { collectDependencies } from "util/dependencies";

export interface BatchPhase {
    /** The script to run this phase */
    script: string;

    /** The start delay for this phase */
    start: number;

    /** The total duration of this phase */
    duration: number;

    /** The number of threads to run this phase */
    threads: number;
}

export interface BatchLogistics {
    /** Hostname of the target of this batch */
    target: string;

    /** RAM required for a single batch */
    batchRam: number;

    /** Maximum number of batches that can run at the same time */
    overlap: number;

    /** How long it takes for all phases of one batch to end */
    endingPeriod: number;

    /** Total RAM to run a full overlap of batches */
    requiredRam: number;

    /** The phases in each batch */
    phases: BatchPhase[];
}

/**
 * Create a list of hosts where each host is repeated `numChunks`
 * times.
 *
 * @param chunks
 * @returns
 */
export function hostListFromChunks(chunks: AllocationChunk[]): string[] {
    const hosts: string[] = [];
    for (const chunk of chunks) {
        for (let i = 0; i < chunk.numChunks; i++) {
            hosts.push(chunk.hostname);
        }
    }
    return hosts;
}


/**
 * Calculate the relative start delays so that all phases finish in order.
 *
 * Modifies the passed phases array so that the relative start times
   cause each phase to end in order.
 *
 * @param phases - The phases to run
 * @returns - Returns the phase array passed in modified with correct start times
 */
export function calculatePhaseStartTimes(phases: BatchPhase[]) {
    const spacing = CONFIG.batchInterval as number;

    let endTime = 0;
    for (const p of phases) {
        p.start = endTime - p.duration;
        endTime += spacing;
    }

    const earliest = Math.abs(Math.min(...phases.map(p => p.start)));
    for (const p of phases) {
        p.start += earliest;
    }
    return phases;
}


/**
 * Exec all phases in a batch on host
 *
 * @param ns - The NS object
 * @param host - Host to run the batch on
 * @param phases - Phases to exec
 * @param donePort - Port where the last phase should send a "complete" message
 * @returns array of pids of all phases
 */
export async function spawnBatch(ns: NS, host: string | null, target: string, phases: BatchPhase[], donePort: number, allocId: number): Promise<number[]> {
    if (!host) return [];

    const scripts = Array.from(new Set(phases.map(p => p.script)));
    let dependencies = scripts.map(script => collectDependencies(ns, script)).reduce((c, s) => c.union(s));
    ns.scp([...scripts, ...dependencies], host, "home");

    let pids = [];
    for (const [idx, phase] of phases.map((phase, idx) => [idx, phase] as [number, BatchPhase])) {
        if (phase.threads <= 0) continue;
        const script = phase.script;

        let lastArg = idx === phases.length - 1 ? donePort : -1;

        let retryCount = 0;
        while (true) {
            if (retryCount > CONFIG.harvestRetryMax) {
                ns.print(`ERROR: harvest repeatedly failed to exec ${script} on ${host}`);
                ns.ui.openTail();
                return pids;
            }

            const pid = ns.exec(script, host, { threads: phase.threads, temporary: true }, target, phase.start, lastArg, TAG_ARG, allocId);
            if (pid === 0) {
                retryCount += 1;
                ns.print(`WARN: failed to exec ${script} on ${host}, trying again with fewer threads`);
                await ns.sleep(CONFIG.harvestRetryWait);
            } else {
                pids.push(pid);
                break;
            }
        }
    }
    return pids;
}
