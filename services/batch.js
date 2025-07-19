import { CONFIG } from "batch/config";
import { ALLOC_ID_ARG } from "services/client/memory_tag";
import { collectDependencies } from "util/dependencies";
/**
 * Create a list of hosts where each host is repeated `numChunks`
 * times.
 *
 * @param chunks
 * @returns
 */
export function hostListFromChunks(chunks) {
    const hosts = [];
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
export function calculatePhaseStartTimes(phases) {
    const spacing = CONFIG.batchInterval;
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
export async function spawnBatch(ns, host, target, phases, donePort, allocId) {
    if (!host)
        return [];
    const scripts = Array.from(new Set(phases.map(p => p.script)));
    let dependencies = scripts.map(script => collectDependencies(ns, script)).reduce((c, s) => c.union(s));
    ns.scp([...scripts, ...dependencies], host, "home");
    let pids = [];
    for (const [idx, phase] of phases.map((phase, idx) => [idx, phase])) {
        if (phase.threads <= 0)
            continue;
        const script = phase.script;
        let lastArg = idx === phases.length - 1 ? donePort : -1;
        let retryCount = 0;
        while (true) {
            if (retryCount > CONFIG.harvestRetryMax) {
                ns.print(`ERROR: harvest repeatedly failed to exec ${script} on ${host}`);
                ns.ui.openTail();
                return pids;
            }
            const pid = ns.exec(script, host, { threads: phase.threads, temporary: true }, target, phase.start, lastArg, ALLOC_ID_ARG, allocId);
            if (pid === 0) {
                retryCount += 1;
                ns.print(`WARN: failed to exec ${script} on ${host}, trying again with fewer threads`);
                await ns.sleep(CONFIG.harvestRetryWait);
            }
            else {
                pids.push(pid);
                break;
            }
        }
    }
    return pids;
}
