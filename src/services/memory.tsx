import type { AutocompleteData, NS, UserInterfaceTheme } from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

import {
    AllocationClaim,
    AllocationClaimRelease,
    AllocationRelease,
    AllocationRequest,
    GrowableAllocationRequest,
    MEMORY_PORT,
    MemoryProtocol,
    MessageType,
    AllocationRegister,
    MEMORY_RESPONSE_PORT,
    MemoryProtocolDef,
} from 'services/client/memory';

import { DiscoveryClient } from 'services/client/discover';

import { fromFixed, MemoryAllocator, Worker } from 'services/allocator';

import { useNsUpdate, useTheme } from 'util/hooks';
import { installLogger } from 'util/logger';
import { BaseServer, Handlers } from 'util/protocol';
import { RingBuffer } from 'util/ring-buffer';
import { HUD_HEIGHT, HUD_WIDTH, STATUS_WINDOW_WIDTH } from 'util/ui';

import { LogRoot } from 'ui/LogRoot';

import {} from 'lib/react';

import { CONFIG } from 'services/config';

const FLAGS = [
    ['refresh-rate', 1000],
    ['help', false],
] satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    const refreshRate = flags['refresh-rate'];
    const rest = flags._ as string[];
    if (rest.length !== 0 || flags.help || typeof refreshRate != 'number') {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

This script handles allocating blocks of memory. A visualization of the
reserved, allocated and free memory for each Worker host can be viewed in
this script's log.

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --help           Show this help message
  --refresh-rate   Time to sleep between displaying memory usage

CONFIGURATION
  SERVICE_memoryGrowCheckRateMs  Length of time between attempting to grow undersized allocations
  SERVICE_memResponseTimeoutMs   How long to attempt to send responses while response port is full
`);
        return;
    }

    ns.disableLog('ALL');
    ns.ui.openTail();
    ns.ui.setTailTitle('Memory Allocator');
    ns.ui.resizeTail(HUD_WIDTH / 2, HUD_HEIGHT);

    const [ww] = ns.ui.windowSize();
    ns.ui.moveTail(ww - (1.5 * HUD_WIDTH + STATUS_WINDOW_WIDTH), 0);

    const bufferCap = 500;
    const { ns: logNS, buffer } = installLogger(ns, { bufferCap });

    await startMemoryAllocator(logNS, buffer);
}

async function startMemoryAllocator(ns: NS, log: RingBuffer<string>) {
    const memoryManager = new MemoryAllocator(ns);

    ns.print(`INFO: starting memory manager on ${ns.self().server}`);

    if (ns.getServerMaxRam('home') > 32) {
        memoryManager.pushWorker('home', 32);
    } else {
        memoryManager.pushWorker('home', 8);
    }

    const discoveryClient = new DiscoveryClient(ns);

    ns.print(`INFO: requesting workers from Discover service`);
    const workers = await discoveryClient.requestWorkers({
        messageType: MessageType.Worker,
        port: MEMORY_PORT,
    });

    ns.print(
        `INFO: received workers from Discover service: ${workers.join(', ')}`,
    );
    for (const worker of workers) {
        memoryManager.pushWorker(worker);
    }

    // Register this script's memory usage
    const self = ns.self();
    memoryManager.registerAllocation({
        pid: self.pid,
        hostname: self.server,
        filename: self.filename,
        chunkSize: self.ramUsage,
        numChunks: 1,
    });

    const server = new Server(ns, memoryManager);
    server.readLoop();

    let lastCollection = Date.now();
    let lastGrowCheck = 0;

    function getWorkers() {
        const purchasedServers = new Set(ns.getPurchasedServers());

        function compareWorkers(a: Worker, b: Worker) {
            if (a.hostname === 'home') return -1;
            else if (b.hostname === 'home') return 1;
            else if (
                purchasedServers.has(a.hostname)
                && purchasedServers.has(b.hostname)
            )
                return a.hostname.localeCompare(b.hostname);
            else if (purchasedServers.has(a.hostname)) return -1;
            else if (purchasedServers.has(b.hostname)) return 1;
            else if (
                a.hostname.startsWith('hacknet-server-')
                && b.hostname.startsWith('hacknet-server-')
            )
                return a.hostname.localeCompare(b.hostname);
            else if (a.hostname.startsWith('hacknet-server-')) return -1;
            else if (b.hostname.startsWith('hacknet-server-')) return 1;
            return 0;
        }

        const workers = Array.from(memoryManager.workers.values());
        workers.sort(compareWorkers);
        return workers;
    }

    ns.clearLog();
    ns.printRaw(
        <LogRoot ns={ns} buffer={log}>
            <MemoryDisplay ns={ns} getWorkers={getWorkers} />
        </LogRoot>,
    );

    while (true) {
        const now = Date.now();

        memoryManager.checkHomeForRamIncrease();

        if (lastCollection + CONFIG.garbageCollectionRateMs < now) {
            memoryManager.updateReserved();
            memoryManager.cleanupTerminated();
            lastCollection = now;
        }

        if (lastGrowCheck + CONFIG.memoryGrowCheckRateMs < now) {
            await growAllocations(ns, memoryManager);
            lastGrowCheck = now;
        }
        await ns.asleep(50);
    }
}

class Server extends BaseServer<MemoryProtocolDef> {
    constructor(ns: NS, memoryManager: MemoryAllocator) {
        const requestPort = ns.getPortHandle(MEMORY_PORT);
        const responsePort = ns.getPortHandle(MEMORY_RESPONSE_PORT);
        const handlers: Handlers<MemoryProtocolDef> = {
            [MessageType.Worker]: async (hostPayload: string | string[]) => {
                const hosts = Array.isArray(hostPayload)
                    ? hostPayload
                    : [hostPayload];
                for (const h of hosts) {
                    memoryManager.pushWorker(h);
                }
            },
            [MessageType.AllocationRequest]: async (
                request: AllocationRequest,
            ) => {
                ns.print(
                    `INFO: request pid=${request.pid} filename=${request.filename} `
                        + `${request.numChunks}x${ns.formatRam(request.chunkSize)} `
                        + `contiguous=${request.contiguous ?? false} `
                        + `coreDependent=${request.coreDependent ?? false} `
                        + `longRunning=${request.longRunning ?? false}`,
                );
                const allocation = memoryManager.allocate(
                    request.pid,
                    request.filename,
                    request.chunkSize,
                    request.numChunks,
                    request.contiguous ?? false,
                    request.coreDependent ?? false,
                    request.shrinkable ?? false,
                    request.longRunning ?? false,
                );
                if (allocation) {
                    ns.print(
                        `SUCCESS: allocated id ${allocation.allocationId} `
                            + `across ${allocation.hosts.length} hosts`,
                    );
                } else {
                    ns.print('WARN: allocation failed, not enough space');
                }
                return allocation;
            },
            [MessageType.GrowableRequest]: async (
                growReq: GrowableAllocationRequest,
            ) => {
                ns.print(
                    `INFO: growable request pid=${growReq.pid} filename=${growReq.filename} `
                        + `${growReq.numChunks}x${ns.formatRam(growReq.chunkSize)}`,
                );
                const growAlloc = memoryManager.allocate(
                    growReq.pid,
                    growReq.filename,
                    growReq.chunkSize,
                    growReq.numChunks,
                    growReq.contiguous ?? false,
                    growReq.coreDependent ?? false,
                    growReq.shrinkable ?? true,
                    growReq.longRunning ?? false,
                    growReq.port,
                );
                if (growAlloc) {
                    ns.print(
                        `SUCCESS: allocated id ${growAlloc.allocationId} `
                            + `across ${growAlloc.hosts.length} hosts`,
                    );
                } else {
                    ns.print('WARN: growable allocation failed');
                }
                return growAlloc;
            },
            [MessageType.Release]: async (release: AllocationRelease) => {
                if (
                    memoryManager.deallocate(
                        release.allocationId,
                        release.pid,
                        release.hostname,
                    )
                ) {
                    ns.print(
                        `SUCCESS: released allocation ${release.allocationId} `
                            + `pid=${release.pid} host=${release.hostname}`,
                    );
                } else {
                    ns.print(
                        `WARN: allocation ${release.allocationId} not found for pid ${release.pid}`,
                    );
                }
            },
            [MessageType.ClaimRelease]: async (
                claimRel: AllocationClaimRelease,
            ) => {
                if (
                    memoryManager.releaseClaim(
                        claimRel.allocationId,
                        claimRel.pid,
                        claimRel.hostname,
                    )
                ) {
                    ns.print(
                        `SUCCESS: released claim for ${claimRel.allocationId} `
                            + `pid=${claimRel.pid} host=${claimRel.hostname}`,
                    );
                } else {
                    ns.print(
                        `WARN: claim for allocation ${claimRel.allocationId} not found for pid ${claimRel.pid}`,
                    );
                }
            },
            [MessageType.Register]: async (reg: AllocationRegister) => {
                ns.print(
                    `INFO: register pid=${reg.pid} host=${reg.hostname} `
                        + `${reg.numChunks}x${ns.formatRam(reg.chunkSize)} `
                        + `${reg.filename}`,
                );
                memoryManager.registerAllocation(reg);
            },
            [MessageType.Status]: async () => {
                return {
                    freeRam: memoryManager.getFreeRamTotal(),
                    chunks: memoryManager.getFreeChunks(),
                };
            },
            [MessageType.Snapshot]: async () => {
                ns.print(`INFO: processing snapshot request`);
                return memoryManager.getSnapshot();
            },
            [MessageType.Claim]: async (claimInfo: AllocationClaim) => {
                if (memoryManager.claimAllocation(claimInfo)) {
                    ns.print(
                        `INFO: claimed allocation ${claimInfo.allocationId} `
                            + `pid=${claimInfo.pid} host=${claimInfo.hostname} `
                            + `${claimInfo.numChunks}x${ns.formatRam(claimInfo.chunkSize)} `
                            + `${claimInfo.filename}`,
                    );
                } else {
                    ns.print(
                        `WARN: failed to claim allocation ${claimInfo.allocationId}`,
                    );
                }
            },
        };

        super(ns, MemoryProtocol, requestPort, responsePort, handlers);
    }
}

async function growAllocations(ns: NS, memoryManager: MemoryAllocator) {
    if (memoryManager.getFreeRamTotal() <= 0) return;

    for (const alloc of memoryManager.allocations.values()) {
        if (alloc.notifyPort === undefined) continue;

        const current = alloc.chunks.reduce((s, c) => s + c.numChunks, 0);
        const missing = alloc.requestedChunks - current;
        if (missing <= 0) continue;

        const newChunks = memoryManager.growAllocation(alloc, missing);
        if (newChunks.length === 0) continue;

        const firstChunk = newChunks[0];
        const host = firstChunk.hostname;
        const chunkSize = ns.formatRam(firstChunk?.chunkSize ?? 0);
        const totalChunks = newChunks.reduce((s, c) => s + c.numChunks, 0);
        ns.print(
            `INFO: growing allocation ${alloc.id} by ${totalChunks}x${chunkSize} from ${host}`,
        );

        const port = ns.getPortHandle(alloc.notifyPort);
        while (!port.tryWrite(newChunks)) {
            await ns.asleep(20);
        }
    }
}

interface MemoryDisplayProps {
    ns: NS;
    getWorkers: (ns: NS) => Worker[];
}

/**
 * Display memory usage for each worker host.
 *
 * @param manager - The allocator to read usage from.
 * @param theme - The UI theme.
 */
function MemoryDisplay({ ns, getWorkers }: MemoryDisplayProps) {
    const theme = useTheme(ns, 200);
    const workers = useNsUpdate(ns, 200, getWorkers);

    const cellStyle = { padding: '0 0.5em' } as const;
    return (
        <div style={{ fontFamily: 'monospace' }}>
            <table>
                <tbody>
                    {workers.map((w, idx) => (
                        <MemoryRow
                            worker={w}
                            theme={theme}
                            rowIndex={idx}
                            cellStyle={cellStyle}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
}

interface MemoryRowProps {
    worker: Worker;
    rowIndex: number;
    cellStyle: object;
    theme: UserInterfaceTheme;
}

function MemoryRow({ worker, rowIndex, cellStyle, theme }: MemoryRowProps) {
    return (
        <tr
            key={worker.hostname}
            style={
                rowIndex % 2 === 1 ? { backgroundColor: theme.well } : undefined
            }
        >
            <td style={{ ...cellStyle, textAlign: 'left' }}>
                {worker.hostname}
            </td>
            <td style={{ ...cellStyle, textAlign: 'right' }}>
                {worker.totalRamStr}
            </td>
            <td style={{ ...cellStyle, textAlign: 'right', minWidth: '215px' }}>
                [<MemoryBar worker={worker} theme={theme}></MemoryBar>]
            </td>
        </tr>
    );
}

interface MemoryBarProps {
    worker: Worker;
    theme: UserInterfaceTheme;
}

function MemoryBar({ worker, theme }: MemoryBarProps) {
    const segments = 20;
    const setAside = fromFixed(worker.setAsideRam);
    const reserved = fromFixed(worker.reservedRam);
    const allocated = fromFixed(worker.allocatedRam);
    const setAsideSeg = calculateBarSegments(
        setAside,
        worker.totalRam,
        segments,
    );
    const reservedSeg = calculateBarSegments(
        reserved,
        worker.totalRam,
        segments,
    );
    const allocSeg = calculateBarSegments(allocated, worker.totalRam, segments);
    const usedSeg = Math.min(segments, setAsideSeg + reservedSeg + allocSeg);
    const freeSeg = segments - usedSeg;

    const setAsideBar = '|'.repeat(setAsideSeg);
    const reservedBar = '|'.repeat(reservedSeg);
    const allocBar = '|'.repeat(allocSeg);
    const freeBar = '-'.repeat(freeSeg);

    return (
        <>
            <span key="s" style={{ color: theme.infolight }}>
                {setAsideBar}
            </span>
            <span key="r" style={{ color: theme.hp }}>
                {reservedBar}
            </span>
            <span key="a" style={{ color: theme.money }}>
                {allocBar}
            </span>
            <span>{freeBar}</span>
        </>
    );
}

function calculateBarSegments(
    segmentRam: number,
    totalRam: number,
    segments: number,
): number {
    if (segmentRam > 1 && totalRam > 0) {
        const numSegments = (segmentRam / totalRam) * segments;
        return numSegments > 0 && numSegments < 1 ? 1 : Math.round(numSegments);
    } else {
        return 0;
    }
}
