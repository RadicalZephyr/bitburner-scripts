import type { AutocompleteData, NS } from "netscript";

import { HostAllocation, MemoryClient, registerAllocationOwnership } from "services/client/memory";
import { TaskSelectorClient, Lifecycle } from "batch/client/task_selector";
import { PortClient } from "services/client/port";

import { CONFIG } from "batch/config";
import {
    analyzeBatchThreads,
    BatchThreadAnalysis,
    fullBatchTime,
    growthAnalyze
} from "batch/expected_value";

import { collectDependencies } from "util/dependencies";

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
        await registerAllocationOwnership(ns, allocationId, "self");
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

    const taskSelectorClient = new TaskSelectorClient(ns);
    const portClient = new PortClient(ns);
    const donePortId = await portClient.requestPort();
    if (typeof donePortId !== 'number') {
        ns.tprint('failed to acquire a port');
        return;
    }
    ns.atExit(() => { portClient.releasePort(donePortId); });

    let lastHeartbeat = 0;

    let hackPercent = maxRam !== -1
        ? maxHackPercentForRam(ns, target, maxRam)
        : CONFIG.maxHackPercent;

    if (maxRam !== -1 && hackPercent === 0) {
        ns.tprint(`max-ram ${ns.formatRam(maxRam)} is too small for one batch`);
        let logistics = calculateBatchLogistics(ns, target);
        ns.tprint(`Minimal batch:\n${JSON.stringify(logistics, null, 2)}`);
        return;
    }

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

    // Track the allocated batchRam chunk size. When we calculate a
    // batch for rebalancing the server we need each rebalancing batch
    // to fit within the batch size that we originally allocated
    const batchRam = logistics.batchRam;

    let memClient = new MemoryClient(ns);
    let allocation = await memClient.requestTransferableAllocation(batchRam, overlapLimit, { shrinkable: true });
    if (!allocation) return;

    allocation.releaseAtExit(ns);

    // Send a Harvest Heartbeat to indicate we're starting the main loop
    taskSelectorClient.tryHeartbeat(ns.pid, ns.getScriptName(), target, Lifecycle.Harvest);

    // Track how many batches can overlap concurrently. If the
    // calculated overlap drops we release the extra memory back to the
    // MemoryManager so it can be reused by other processes.
    let maxOverlap = allocation.numChunks;
    let currentBatches = 0;

    let batchHost: SparseHostArray = makeBatchHostArray(allocation.allocatedChunks);

    let batches = [];

    ns.print(`INFO: spawning initial round of ${maxOverlap} batches`);
    // Launch one batch per allocated chunk so that the pipeline is
    // fully populated before entering the steady state loop.
    for (let i = 0; i < maxOverlap; ++i) {
        const host = batchHost.at(i);
        let batchPids = await spawnBatch(ns, host, target, logistics.phases, donePortId);
        batches.push(batchPids);
        currentBatches++;
        if (Date.now() >= lastHeartbeat + CONFIG.heartbeatCadence) {
            taskSelectorClient.tryHeartbeat(ns.pid, ns.getScriptName(), target, Lifecycle.Harvest);
            lastHeartbeat = Date.now();
        }

        await ns.sleep(logistics.endingPeriod);
    }

    const finishedPort = ns.getPortHandle(donePortId);

    ns.printf("INFO: launched initial round, going into batch respawn loop");
    while (true) {
        let batchIndex = currentBatches % maxOverlap;
        const host = batchHost.at(batchIndex);
        let lastScriptPid = batches[batchIndex]?.at(-1);
        if (typeof lastScriptPid === "number") {
            let missedMessages = 0;
            while (finishedPort.read() !== "NULL PORT DATA") {
                missedMessages += 1;
            }
            if (missedMessages > 0) {
                ns.print(`WARN: missed ${missedMessages} while spawning new batch`);
            }
            await finishedPort.nextWrite();
            let donePid = finishedPort.read();
            if (typeof donePid === "number" && lastScriptPid !== donePid) {
                ns.print(`INFO: expected to receive done message from ${lastScriptPid}, got ${donePid}`);
            }
        } else {
            ns.print(`WARN: lastScriptPid was not a number, did scripts fail to launch?`);
            // Safety sleep to avoid hanging
            await ns.sleep(10);
        }

        const actualSecurity = ns.getServerSecurityLevel(target);
        const minSecurity = ns.getServerMinSecurityLevel(target);
        const maxMoney = ns.getServerMaxMoney(target);
        const actualMoney = ns.getServerMoneyAvailable(target);

        let phases = logistics.phases;
        if (actualSecurity > minSecurity + CONFIG.minSecTolerance || actualMoney < maxMoney * CONFIG.maxMoneyTolerance) {
            const rebalance = calculateRebalanceBatchLogistics(ns, target, batchRam);
            if (rebalance.batchRam <= batchRam) {
                const secDelta = (actualSecurity - minSecurity).toFixed(2);
                const moneyPct = ns.formatPercent(actualMoney / maxMoney);
                ns.print(
                    `INFO: rebalancing ${target} sec +${secDelta} money ${moneyPct} ` +
                    `ram ${ns.formatRam(rebalance.batchRam)}`
                );
                phases = rebalance.phases;
            }
        } else {
            let logistics = calculateBatchLogistics(ns, target, hackPercent);
            phases = logistics.phases;

            const desiredOverlap = Math.min(overlapLimit, logistics.overlap);

            if (desiredOverlap < maxOverlap) {
                const toRelease = maxOverlap - desiredOverlap;
                ns.print(`WARN: overlap decreasing. Could release ${toRelease} chunks...`);
            }
        }

        let batchPids = await spawnBatch(ns, host, target, phases, donePortId);
        if (batchPids.length > 0) {
            batches[batchIndex] = batchPids;
            currentBatches++;
        }

        if (currentBatches > maxOverlap) {
            currentBatches = currentBatches % maxOverlap;
        }
        if (Date.now() >= lastHeartbeat + CONFIG.heartbeatCadence + (Math.random() * 500)) {
            if (taskSelectorClient.tryHeartbeat(ns.pid, ns.getScriptName(), target, Lifecycle.Harvest)) {
                lastHeartbeat = Date.now();
            }
        }
    }
}

interface SparseHostEntry {
    start: number;
    end: number;
    hostname: string;
}

class SparseHostArray {
    private intervals: SparseHostEntry[] = [];

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

async function spawnBatch(ns: NS, host: string | null, target: string, phases: BatchPhase[], donePort: number): Promise<number[]> {
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

            const pid = ns.exec(script, host, { threads: phase.threads, temporary: true }, target, phase.start, lastArg);
            if (pid === 0) {
                retryCount += 1;
                ns.print(`WARN: failed to exec ${script} on ${host}, trying again`);
                await ns.sleep(CONFIG.harvestRetryWait);
            } else {
                pids.push(pid);
                break;
            }
        }
    }
    return pids;
}

export interface BatchLogistics {
    target: string;
    batchRam: number;
    overlap: number;
    endingPeriod: number;
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

    const batchTime = fullBatchTime(ns, target);

    const endingPeriod = CONFIG.batchInterval * 4;
    const overlap = Math.ceil(batchTime / endingPeriod);
    const requiredRam = batchRam * overlap;

    return {
        target,
        batchRam,
        overlap,
        endingPeriod,
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
 * milliseconds after the previous one. Durations account for the
 * player's hacking speed multiplier.
 */
export function calculateBatchPhases(ns: NS, target: string, threads: BatchThreadAnalysis): BatchPhase[] {
    const hackTime = ns.getHackTime(target);
    const weakenTime = ns.getWeakenTime(target);
    const growTime = ns.getGrowTime(target);

    const phases: BatchPhase[] = [
        { script: "/batch/h.js", start: 0, duration: hackTime, threads: threads.hackThreads },
        { script: "/batch/w.js", start: 0, duration: weakenTime, threads: threads.postHackWeakenThreads },
        { script: "/batch/g.js", start: 0, duration: growTime, threads: threads.growThreads },
        { script: "/batch/w.js", start: 0, duration: weakenTime, threads: threads.postGrowWeakenThreads },
    ];

    return calculatePhaseStartTimes(phases);
}

interface RebalanceBatchLogistics {
    batchRam: number;
    phases: BatchPhase[];
}

/** Calculate threads and timings for a weaken-grow-weaken batch to
 *  restore a server to minimum security and maximum money.
 *
 *  The returned batch always requires no more RAM than `maxBatchRam`.
 */
export function calculateRebalanceBatchLogistics(
    ns: NS,
    target: string,
    maxBatchRam: number,
): RebalanceBatchLogistics {
    const wRam = ns.getScriptRam('/batch/w.js', 'home');
    const gRam = ns.getScriptRam('/batch/g.js', 'home');

    let minSec = ns.getServerMinSecurityLevel(target);
    let curSec = ns.getServerSecurityLevel(target);
    let deltaSec = curSec - minSec;
    let weakenThreads = calculateWeakenThreads(deltaSec);
    let usedRam = weakenThreads * wRam;

    if (usedRam > maxBatchRam) {
        weakenThreads = Math.floor(maxBatchRam / wRam);
        usedRam = weakenThreads * wRam;
        const phases = calculateRebalancePhases(ns, target, weakenThreads, 0, 0);
        return { batchRam: usedRam, phases };
    }

    const currentMoney = ns.getServerMoneyAvailable(target);
    let growThreads = growthAnalyze(ns, target, currentMoney);

    let postGrowWeaken = calculateWeakenThreads(ns.growthAnalyzeSecurity(growThreads, target));

    while (growThreads > 0) {
        postGrowWeaken = calculateWeakenThreads(ns.growthAnalyzeSecurity(growThreads, target));
        const totalRam = usedRam + growThreads * gRam + postGrowWeaken * wRam;
        if (totalRam <= maxBatchRam) {
            usedRam = totalRam;
            break;
        }
        growThreads--;
    }

    if (growThreads === 0) {
        postGrowWeaken = 0;
        usedRam = weakenThreads * wRam;
    }

    const phases = calculateRebalancePhases(ns, target, weakenThreads, growThreads, postGrowWeaken);
    return { batchRam: usedRam, phases };
}

function calculateWeakenThreads(deltaSec: number) {
    return Math.ceil(deltaSec * 20) + 1;
}

function calculateRebalancePhases(
    ns: NS,
    target: string,
    weakenThreads: number,
    growThreads: number,
    postGrowThreads: number,
): BatchPhase[] {
    const weakenTime = ns.getWeakenTime(target);
    const growTime = ns.getGrowTime(target);

    let phases: BatchPhase[] = [
        { script: '/batch/w.js', start: 0, duration: weakenTime, threads: weakenThreads },
        { script: '/batch/g.js', start: 0, duration: growTime, threads: growThreads },
        { script: '/batch/w.js', start: 0, duration: weakenTime, threads: postGrowThreads },
    ];
    // Remove phases with zero threads so we won't fail to exec a
    // phase. This helps ensure that the batch "done" message will
    // always be sent and allow the harvester to continue progressing.
    phases = phases.filter(p => p.threads > 0);
    return calculatePhaseStartTimes(phases);
}

function calculatePhaseStartTimes(phases: BatchPhase[]) {
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

function maxHackPercentForRam(ns: NS, target: string, maxRam: number): number {
    const minPercent = (() => {
        if (canUseFormulas(ns)) {
            const server = ns.getServer(target);
            const player = ns.getPlayer();
            return ns.formulas.hacking.hackPercent(server, player);
        }
        return ns.hackAnalyze(target);
    })();

    const { batchRam: minBatchRam, overlap: minOverlap } =
        calculateBatchLogistics(ns, target, minPercent);

    if (minBatchRam * minOverlap > maxRam) return minPercent;

    let low = minPercent;
    let high = CONFIG.maxHackPercent;
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

/** Calculate the number of hack threads needed to steal the given
 *  percentage of the target server's max money.
 *
 * @param ns      - Netscript API instance
 * @param host    - Hostname of the target server
 * @param percent - Desired money percentage to hack (0-1)
 * @returns Required hack thread count, adjusted for player hacking multipliers
 */
export function hackThreadsForPercent(
    ns: NS,
    host: string,
    percent: number,
): number {
    if (percent <= 0) return 0;

    let hackPercent: number;
    if (canUseFormulas(ns)) {
        const server = ns.getServer(host);
        const player = ns.getPlayer();
        hackPercent = ns.formulas.hacking.hackPercent(server, player);
    } else {
        hackPercent = ns.hackAnalyze(host);
    }

    if (hackPercent <= 0) return 0;

    return Math.ceil(percent / hackPercent);
}

function canUseFormulas(ns: NS): boolean {
    return ns.fileExists("Formulas.exe", "home");
}
