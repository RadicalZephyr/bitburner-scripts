import type { AutocompleteData, NS } from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

import {
    BatchLogistics,
    BatchPhase,
    calculatePhaseStartTimes,
    hostListFromChunks,
    spawnBatch,
} from 'services/batch';

import {
    GrowableMemoryClient,
    GrowableAllocation,
} from 'services/client/growable_memory';
import { AllocationChunk } from 'services/client/memory';

import { PortClient } from 'services/client/port';
import {
    Message,
    MessageType as HarvestMessageType,
} from 'batch/client/harvest';
import { TaskSelectorClient, Lifecycle } from 'batch/client/task_selector';

import {
    calculateBatchLogistics,
    growthAnalyze,
    maxHackPercentForMemory,
} from 'batch/expected_value';

import { CONFIG } from 'batch/config';

import { readAllFromPort, readLoop } from 'util/ports';

const FLAGS = [
    ['max-ram', -1],
    ['port-id', -1],
    ['help', false],
] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return data.servers;
}

export async function main(ns: NS) {
    ns.disableLog('ALL');

    const args = await parseArgs(ns);
    if (!args) return;

    const setup = await prepareHarvest(ns, args);
    if (!setup) return;

    await harvestPipeline(ns, args.target, setup);
}

interface DoneMsg {
    pid: number;
    host: string;
}

interface ParsedArgs {
    target: string;
    maxRam: number;
    portId: number;
}

interface HarvestSetup {
    logistics: BatchLogistics;
    overlapLimit: number;
    hackPercent: number;
    allocation: GrowableAllocation;
    memClient: GrowableMemoryClient;
    taskSelectorClient: TaskSelectorClient;
    donePortId: number;
    portId: number;
    shuttingDown: { value: boolean };
    batchRam: number;
}

async function parseArgs(ns: NS): Promise<ParsedArgs | null> {
    const flags = await parseFlags(ns, FLAGS);

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
  --port-id        Control port for shutdown messages

CONFIGURATION
  BATCH_heartbeatCadence   Interval between heartbeat messages
  BATCH_minSecTolerance    Security tolerance before re-tilling
  BATCH_maxMoneyTolerance  Money percentage threshold before re-sowing
`);
        return null;
    }

    const maxRam = flags['max-ram'];
    if (maxRam !== -1) {
        if (typeof maxRam !== 'number' || maxRam <= 0) {
            ns.tprint('--max-ram must be a positive number');
            return null;
        }
    }

    const portId = flags['port-id'];
    if (typeof portId !== 'number' || !Number.isInteger(portId) || portId < 1) {
        ns.tprint('--port-id must be a valid port number');
        return null;
    }

    const target = rest[0];
    if (typeof target !== 'string' || !ns.serverExists(target)) {
        ns.tprintf('target %s does not exist', target);
        return null;
    }

    return { target, maxRam, portId };
}

async function prepareHarvest(
    ns: NS,
    args: ParsedArgs,
): Promise<HarvestSetup | null> {
    const taskSelectorClient = new TaskSelectorClient(ns);
    const portClient = new PortClient(ns);
    const donePortId = await portClient.requestPort();
    if (typeof donePortId !== 'number') {
        ns.tprint('failed to acquire a port');
        return null;
    }
    ns.atExit(() => {
        portClient.releasePort(donePortId);
        portClient.releasePort(args.portId);
    });

    const shuttingDown = { value: false };
    const controlPort = ns.getPortHandle(args.portId);
    readLoop(ns, controlPort, async () => {
        for (const msg of readAllFromPort(ns, controlPort)) {
            const m = msg as Message;
            if (Array.isArray(m) && m[0] === HarvestMessageType.Shutdown) {
                shuttingDown.value = true;
            }
        }
    });

    const memClient = new GrowableMemoryClient(ns);
    const memInfo = await memClient.getFreeRam();

    const hackPercent = maxHackPercentForMemory(ns, args.target, memInfo);

    if (hackPercent === 0) {
        ns.print(
            `total free RAM ${ns.formatRam(memInfo.freeRam)} is too small for one minimal batch`,
        );
        const logistics = calculateBatchLogistics(ns, args.target);
        ns.print(`Minimal batch:\n${JSON.stringify(logistics, null, 2)}`);
        return null;
    }

    const logistics = calculateBatchLogistics(ns, args.target, hackPercent);
    let overlapLimit = logistics.overlap;
    if (args.maxRam !== -1) {
        overlapLimit = Math.min(
            overlapLimit,
            Math.floor(args.maxRam / logistics.batchRam),
        );
    }
    if (overlapLimit < 1) {
        ns.print(
            `max-ram ${ns.formatRam(args.maxRam)} is too small for one batch`,
        );
        return null;
    }

    const requiredRam = logistics.batchRam * overlapLimit;
    ns.printf(
        `%s: batch ram %s, overlap x%d => required %s\nphases: %s`,
        logistics.target,
        ns.formatRam(logistics.batchRam),
        overlapLimit,
        ns.formatRam(requiredRam),
        JSON.stringify(logistics.phases, undefined, 2),
    );

    // Track the allocated batchRam chunk size. When we calculate a
    // batch for rebalancing the server we need each rebalancing batch
    // to fit within the batch size that we originally allocated
    const batchRam = logistics.batchRam;
    const allocation = await memClient.requestGrowableAllocation(
        batchRam,
        overlapLimit,
        { shrinkable: true },
    );
    if (!allocation) return null;
    allocation.releaseAtExit(ns);

    taskSelectorClient.tryHeartbeat(
        ns.pid,
        ns.getScriptName(),
        args.target,
        Lifecycle.Harvest,
    );

    // Track how many batches can overlap concurrently. If the
    // calculated overlap drops we release the extra memory back to the
    // MemoryManager so it can be reused by other processes.
    return {
        logistics,
        overlapLimit,
        hackPercent,
        allocation,
        memClient,
        taskSelectorClient,
        donePortId,
        portId: args.portId,
        shuttingDown,
        batchRam,
    };
}

async function harvestPipeline(ns: NS, target: string, setup: HarvestSetup) {
    const {
        logistics,
        overlapLimit,
        hackPercent,
        allocation,
        memClient,
        taskSelectorClient,
        donePortId,
        shuttingDown,
    } = setup;

    let lastHeartbeat = 0;
    let maxOverlap = allocation.numChunks;
    let currentBatches = 0;

    let hosts = hostListFromChunks(allocation.allocatedChunks);
    let batches: number[][] = [];
    const pidHostMap = new Map<number, string>();

    ns.print(`INFO: spawning initial round of ${maxOverlap} batches`);
    // Launch one batch per allocated chunk so that the pipeline is
    // fully populated before entering the steady state loop.
    for (const host of hosts) {
        if (shuttingDown.value) break;
        const batchPids = await spawnBatch(
            ns,
            host,
            target,
            logistics.phases,
            donePortId,
            allocation.allocationId,
        );
        batches.push(batchPids);
        const lastPid = batchPids.at(-1);
        if (typeof lastPid === 'number') pidHostMap.set(lastPid, host);
        currentBatches++;
        if (Date.now() >= lastHeartbeat + CONFIG.heartbeatCadence) {
            taskSelectorClient.tryHeartbeat(
                ns.pid,
                ns.getScriptName(),
                target,
                Lifecycle.Harvest,
            );
            lastHeartbeat = Date.now();
        }

        await ns.asleep(logistics.endingPeriod);
    }

    const finishedPort = ns.getPortHandle(donePortId);
    ns.printf('INFO: launched initial round, going into batch respawn loop');

    while (!shuttingDown.value) {
        allocation.pollGrowth();
        const newHosts = hostListFromChunks(allocation.allocatedChunks);
        if (newHosts.length < hosts.length) {
            batches = cancelRemovedBatches(ns, hosts, newHosts, batches);
            if (currentBatches >= newHosts.length) {
                currentBatches %= newHosts.length;
            }
        }
        hosts = newHosts;
        if (hosts.length === 0) break;
        const spawnIndex = currentBatches % hosts.length;
        if (
            !shuttingDown.value
            && spawnIndex === 0
            && hosts.length > batches.length
        ) {
            ns.print(
                `INFO: allocation grew to ${hosts.length} chunks. `
                    + `Spawning ${hosts.length - batches.length} additional batches`,
            );
            for (let i = batches.length; i < hosts.length; i++) {
                const extraPids = await spawnBatch(
                    ns,
                    hosts[i],
                    target,
                    logistics.phases,
                    donePortId,
                    allocation.allocationId,
                );
                batches[i] = extraPids;
                const lastPid = extraPids.at(-1);
                if (typeof lastPid === 'number')
                    pidHostMap.set(lastPid, hosts[i]);
                currentBatches++;
                if (Date.now() >= lastHeartbeat + CONFIG.heartbeatCadence) {
                    taskSelectorClient.tryHeartbeat(
                        ns.pid,
                        ns.getScriptName(),
                        target,
                        Lifecycle.Harvest,
                    );
                    lastHeartbeat = Date.now();
                }
                await ns.asleep(logistics.endingPeriod);
            }
        } else if (hosts.length < batches.length) {
            batches.length = hosts.length;
            if (currentBatches >= hosts.length) {
                currentBatches %= hosts.length;
            }
        }

        maxOverlap = hosts.length;

        if (finishedPort.peek() === 'NULL PORT DATA') {
            await finishedPort.nextWrite();
        }
        const msg = finishedPort.read();
        const doneMsg = parseDoneMsg(ns, msg);
        if (!doneMsg) {
            ns.print(
                `WARN: malformed batch completion message ${JSON.stringify(msg)}`,
            );
            await ns.asleep(10);
            continue;
        }

        const donePid = doneMsg.pid;
        const msgHost = doneMsg.host;

        const mappedHost = pidHostMap.get(donePid);
        if (mappedHost !== undefined && mappedHost !== msgHost) {
            ns.print(
                `WARN: completion host mismatch for pid ${donePid}. expected ${mappedHost}, got ${msgHost}`,
            );
        }
        pidHostMap.delete(donePid);

        let batchIndex = batches.findIndex((p) => p?.includes(donePid));
        if (batchIndex === -1) {
            batchIndex = hosts.indexOf(msgHost);
        }
        if (batchIndex === -1) {
            ns.print(
                `WARN: could not determine batch index for host ${msgHost}`,
            );
            batchIndex = currentBatches % hosts.length;
        }

        let host = msgHost;
        if (!hosts.includes(host)) {
            ns.print(
                `ERROR: host ${host} from completion message not in host list`,
            );
            host = mappedHost ?? host;
        }

        const newLogistics = calculateBatchLogistics(ns, target, hackPercent);
        const phases = newLogistics.phases;

        const desiredOverlap = Math.min(overlapLimit, newLogistics.overlap);

        if (desiredOverlap < allocation.numChunks) {
            const toRelease = allocation.numChunks - desiredOverlap;
            const beforeHosts = hosts;
            const result = await memClient.releaseChunks(
                allocation.allocationId,
                toRelease,
            );
            if (result) {
                allocation.allocatedChunks = result.hosts.map(
                    (h) => new AllocationChunk(h),
                );
                const shrinkHosts = hostListFromChunks(
                    allocation.allocatedChunks,
                );
                batches = cancelRemovedBatches(
                    ns,
                    beforeHosts,
                    shrinkHosts,
                    batches,
                );
                hosts = shrinkHosts;
                if (currentBatches >= hosts.length) {
                    currentBatches %= hosts.length;
                }
                maxOverlap = hosts.length;
                ns.print(`INFO: released ${toRelease} chunks from allocation`);
            } else {
                ns.print(`WARN: failed to release ${toRelease} chunks`);
            }
        }

        let batchPids: number[] = [];
        if (!shuttingDown.value) {
            batchPids = await spawnBatch(
                ns,
                host,
                target,
                phases,
                donePortId,
                allocation.allocationId,
            );
            if (batchPids.length > 0) {
                batches[batchIndex] = batchPids;
                const lastPid = batchPids.at(-1);
                if (typeof lastPid === 'number') pidHostMap.set(lastPid, host);
                currentBatches++;
            }
        } else {
            batches[batchIndex] = [];
        }

        if (currentBatches > maxOverlap) {
            currentBatches = currentBatches % maxOverlap;
        }
        if (
            Date.now()
            >= lastHeartbeat + CONFIG.heartbeatCadence + Math.random() * 500
        ) {
            if (
                taskSelectorClient.tryHeartbeat(
                    ns.pid,
                    ns.getScriptName(),
                    target,
                    Lifecycle.Harvest,
                )
            ) {
                lastHeartbeat = Date.now();
            }
        }
    }

    for (const pids of batches) {
        for (const pid of pids) {
            if (ns.isRunning(pid)) ns.kill(pid);
        }
        pids.length = 0;
    }
    ns.print('INFO: harvest shutdown complete');
}

function hostCountMap(hosts: string[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const h of hosts) {
        const c = counts.get(h) ?? 0;
        counts.set(h, c + 1);
    }
    return counts;
}

function cancelRemovedBatches(
    ns: NS,
    prevHosts: string[],
    newHosts: string[],
    batches: number[][],
): number[][] {
    const remaining = hostCountMap(newHosts);
    const keep: number[][] = [];
    for (let i = 0; i < prevHosts.length; i++) {
        const host = prevHosts[i];
        const allowed = remaining.get(host) ?? 0;
        if (allowed > 0) {
            remaining.set(host, allowed - 1);
            keep.push(batches[i]);
        } else {
            for (const pid of batches[i] ?? []) {
                if (ns.isRunning(pid)) ns.kill(pid);
            }
        }
    }
    return keep;
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

    const minSec = ns.getServerMinSecurityLevel(target);
    const curSec = ns.getServerSecurityLevel(target);
    const deltaSec = curSec - minSec;
    let weakenThreads = calculateWeakenThreads(deltaSec);
    let usedRam = weakenThreads * wRam;

    if (usedRam > maxBatchRam) {
        weakenThreads = Math.floor(maxBatchRam / wRam);
        usedRam = weakenThreads * wRam;
        const phases = calculateRebalancePhases(
            ns,
            target,
            weakenThreads,
            0,
            0,
        );
        return { batchRam: usedRam, phases };
    }

    const currentMoney = ns.getServerMoneyAvailable(target);
    let growThreads = growthAnalyze(ns, target, currentMoney);

    let postGrowWeaken = calculateWeakenThreads(
        ns.growthAnalyzeSecurity(growThreads, target),
    );

    while (growThreads > 0) {
        postGrowWeaken = calculateWeakenThreads(
            ns.growthAnalyzeSecurity(growThreads, target),
        );
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

    const phases = calculateRebalancePhases(
        ns,
        target,
        weakenThreads,
        growThreads,
        postGrowWeaken,
    );
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
        {
            script: '/batch/w.js',
            start: 0,
            duration: weakenTime,
            threads: weakenThreads,
        },
        {
            script: '/batch/g.js',
            start: 0,
            duration: growTime,
            threads: growThreads,
        },
        {
            script: '/batch/w.js',
            start: 0,
            duration: weakenTime,
            threads: postGrowThreads,
        },
    ];
    // Remove phases with zero threads so we won't fail to exec a
    // phase. This helps ensure that the batch "done" message will
    // always be sent and allow the harvester to continue progressing.
    phases = phases.filter((p) => p.threads > 0);
    return calculatePhaseStartTimes(phases);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseDoneMsg(ns: NS, msg: any): DoneMsg | null {
    if (
        typeof msg === 'object'
        && msg !== null
        && Object.hasOwn(msg, 'pid')
        && Object.hasOwn(msg, 'host')
        && typeof msg.pid === 'number'
        && typeof msg.host === 'string'
    ) {
        return msg as DoneMsg;
    }
    return null;
}
