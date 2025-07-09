import { CONFIG } from "batch/config";

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
