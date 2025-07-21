import type { NS, NetscriptPort, UserInterfaceTheme } from "netscript";
import { ALLOC_ID, MEM_TAG_FLAGS } from "services/client/memory_tag";
import { parseAndRegisterAlloc, ResponsePayload } from "services/client/memory";

import {
    AllocationClaim,
    AllocationClaimRelease,
    AllocationRelease,
    AllocationRequest,
    GrowableAllocationRequest,
    MEMORY_PORT,
    Message,
    MessageType,
    AllocationChunksRelease,
    AllocationRegister,
    MEMORY_RESPONSE_PORT,
} from "services/client/memory";

import { DiscoveryClient } from "services/client/discover";

import { fromFixed, MemoryAllocator, Worker } from "services/allocator";

import { readAllFromPort, readLoop } from "util/ports";
import { HUD_HEIGHT, HUD_WIDTH, STATUS_WINDOW_WIDTH } from "util/ui";

import { sleep } from "util/time";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const React: any;


let printLog: (msg: string) => void;

export async function main(ns: NS) {
    const flags = ns.flags([
        ['refresh-rate', 1000],
        ['help', false],
        ...MEM_TAG_FLAGS
    ]);

    const refreshRate = flags['refresh-rate'];
    const rest = flags._ as string[];
    if (rest.length !== 0 || flags.help || typeof refreshRate != 'number') {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

This script handles allocating blocks of memory. A visualization of the
reserved, allocated and free memory for each Worker host can be viewed in
this script's log.

OPTIONS
--help           Show this help message
--refresh-rate   Time to sleep between displaying memory usage

Example:

> run ${ns.getScriptName()}
`);
        return;
    }

    const allocationId = await parseAndRegisterAlloc(ns, flags);
    if (flags[ALLOC_ID] !== -1 && allocationId === null) {
        return;
    }

    ns.disableLog("ALL");
    ns.ui.openTail();
    ns.ui.setTailTitle("Memory Allocator");
    ns.ui.resizeTail(HUD_WIDTH, HUD_HEIGHT);

    const [ww] = ns.ui.windowSize();
    ns.ui.moveTail(ww - ((2 * HUD_WIDTH) + STATUS_WINDOW_WIDTH), 0);

    const log: string[] = [];
    const maxLog = 72;
    printLog = (msg: string) => {
        log.push(msg);
        if (log.length > maxLog) {
            log.shift();
        }
    };

    const memPort = ns.getPortHandle(MEMORY_PORT);
    const memResponsePort = ns.getPortHandle(MEMORY_RESPONSE_PORT);

    const memoryManager = new MemoryAllocator(ns, printLog);

    printLog(`INFO: starting memory manager on ${ns.self().server}`);

    if (ns.getServerMaxRam("home") > 32) {
        memoryManager.pushWorker("home", 32);
    } else {
        memoryManager.pushWorker("home", 8);
    }

    const discoveryClient = new DiscoveryClient(ns);

    printLog(`INFO: requesting workers from Discover service`);
    const workers = await discoveryClient.requestWorkers({ messageType: MessageType.Worker, port: MEMORY_PORT });

    printLog(`INFO: received workers from Discover service: ${workers.join(", ")}`);
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
        numChunks: 1
    });

    const collectionRate = 1000 * 10;

    let lastRender = 0;
    let lastCollection = Date.now();
    let lastGrowCheck = 0;
    const growCheckRate = 1000;

    readLoop(ns, memPort, async () => readMemRequestsFromPort(ns, memPort, memResponsePort, memoryManager));

    while (true) {
        const now = Date.now();

        memoryManager.checkHomeForRamIncrease();

        if (lastRender + refreshRate < now) {
            const theme = ns.ui.getTheme();
            ns.clearLog();
            ns.printRaw(
                <div style={{ display: "flex", gap: "1em" }}>
                    <MemoryDisplay manager={memoryManager} theme={theme}></MemoryDisplay>
                    <LogDisplay lines={log} theme={theme}></LogDisplay>
                </div>
            );
            lastRender = now;
        }

        if (lastCollection + collectionRate < now) {
            printLog("INFO: running garbage collection");
            memoryManager.updateReserved();
            memoryManager.cleanupTerminated();
            lastCollection = now;
        }

        if (lastGrowCheck + growCheckRate < now) {
            await growAllocations(ns, memoryManager);
            lastGrowCheck = now;
        }
        await sleep(50);
    }
}

function readMemRequestsFromPort(ns: NS, memPort: NetscriptPort, memResponsePort: NetscriptPort, memoryManager: MemoryAllocator) {
    for (const nextMsg of readAllFromPort(ns, memPort)) {
        const msg = nextMsg as Message;
        const requestId: string = msg[1] as string;
        let payload: ResponsePayload;
        switch (msg[0]) {
            case MessageType.Worker: {
                const hostPayload = msg[2];
                const hosts = Array.isArray(hostPayload) ? hostPayload : [hostPayload as string];
                for (const h of hosts) {
                    memoryManager.pushWorker(h);
                }
                // Don't send a response, no one is listening.
                continue;
            }
            case MessageType.Request: {
                const request = msg[2] as AllocationRequest;
                printLog(
                    `INFO: request pid=${request.pid} filename=${request.filename} ` +
                    `${request.numChunks}x${ns.formatRam(request.chunkSize)} ` +
                    `contiguous=${request.contiguous ?? false} ` +
                    `coreDependent=${request.coreDependent ?? false} ` +
                    `longRunning=${request.longRunning ?? false}`
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
                    printLog(
                        `SUCCESS: allocated id ${allocation.allocationId} ` +
                        `across ${allocation.hosts.length} hosts`
                    );
                } else {
                    printLog("WARN: allocation failed, not enough space");
                }
                payload = allocation;
                break;
            }
            case MessageType.GrowableRequest: {
                const growReq = msg[2] as GrowableAllocationRequest;
                printLog(
                    `INFO: growable request pid=${growReq.pid} filename=${growReq.filename} ` +
                    `${growReq.numChunks}x${ns.formatRam(growReq.chunkSize)}`
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
                    printLog(
                        `SUCCESS: allocated id ${growAlloc.allocationId} ` +
                        `across ${growAlloc.hosts.length} hosts`
                    );
                } else {
                    printLog("WARN: growable allocation failed");
                }
                payload = growAlloc;
                break;
            }
            case MessageType.Release: {
                const release = msg[2] as AllocationRelease;
                if (memoryManager.deallocate(release.allocationId, release.pid, release.hostname)) {
                    printLog(
                        `SUCCESS: released allocation ${release.allocationId} ` +
                        `pid=${release.pid} host=${release.hostname}`
                    );
                } else {
                    printLog(
                        `WARN: allocation ${release.allocationId} not found for pid ${release.pid}`
                    );
                }
                // Don't send a response, no one is listening.
                continue;
            }
            case MessageType.ClaimRelease: {
                const claimRel = msg[2] as AllocationClaimRelease;
                if (memoryManager.releaseClaim(claimRel.allocationId, claimRel.pid, claimRel.hostname)) {
                    printLog(
                        `SUCCESS: released claim for ${claimRel.allocationId} ` +
                        `pid=${claimRel.pid} host=${claimRel.hostname}`
                    );
                } else {
                    printLog(
                        `WARN: claim for allocation ${claimRel.allocationId} not found for pid ${claimRel.pid}`
                    );
                }
                // Don't send a response, no one is listening.
                continue;
            }
            case MessageType.ReleaseChunks: {
                const releaseInfo = msg[2] as AllocationChunksRelease;
                printLog(
                    `INFO: release ${releaseInfo.numChunks} chunks from ` +
                    `allocation ${releaseInfo.allocationId}`
                );
                payload = memoryManager.releaseChunks(
                    releaseInfo.allocationId,
                    releaseInfo.numChunks,
                );
                break;
            }
            case MessageType.Register: {
                const reg = msg[2] as AllocationRegister;
                printLog(
                    `INFO: register pid=${reg.pid} host=${reg.hostname} ` +
                    `${reg.numChunks}x${ns.formatRam(reg.chunkSize)} ` +
                    `${reg.filename}`
                );
                memoryManager.registerAllocation(reg);
                // Don't send a response, no one is listening.
                continue;
            }
            case MessageType.Status: {
                payload = { freeRam: memoryManager.getFreeRamTotal() };
                break;
            }
            case MessageType.Snapshot: {
                printLog(`INFO: processing snapshot request ${requestId}`);
                payload = memoryManager.getSnapshot();
                break;
            }
            case MessageType.Claim: {
                const claimInfo = msg[2] as AllocationClaim;
                if (memoryManager.claimAllocation(claimInfo)) {
                    printLog(
                        `INFO: claimed allocation ${claimInfo.allocationId} ` +
                        `pid=${claimInfo.pid} host=${claimInfo.hostname} ` +
                        `${claimInfo.numChunks}x${ns.formatRam(claimInfo.chunkSize)} ` +
                        `${claimInfo.filename}`
                    );
                } else {
                    printLog(`WARN: failed to claim allocation ${claimInfo.allocationId}`);
                }
                // Don't send a response, no one is listening.
                continue;
            }
        }
        // TODO: make this more robust when the response port is full
        memResponsePort.write([requestId, payload]);
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
        printLog(`INFO: growing allocation ${alloc.id} by ${totalChunks}x${chunkSize} from ${host}`);

        const port = ns.getPortHandle(alloc.notifyPort);
        while (!port.tryWrite(newChunks)) {
            await ns.sleep(20);
        }
    }
}

interface MemoryDisplayProps {
    manager: MemoryAllocator;
    theme: UserInterfaceTheme;
}

/**
 * Display memory usage for each worker host.
 *
 * @param manager - The allocator to read usage from.
 * @param theme - The UI theme.
 */
function MemoryDisplay({ manager, theme }: MemoryDisplayProps) {
    const workers = Array.from(manager.workers.values());
    const cellStyle = { padding: "0 0.5em" } as const;
    return (
        <div style={{ fontFamily: "monospace" }}>
            <table>
                <tbody>
                    {workers.map((w, idx) =>
                        <MemoryRow worker={w} theme={theme} rowIndex={idx} cellStyle={cellStyle}></MemoryRow>
                    )}
                </tbody>
            </table>
        </div>
    );
}

interface LogDisplayProps {
    lines: string[];
    theme: UserInterfaceTheme;
}

/**
 * Show recent log lines in a styled list.
 *
 * @param lines - Log messages to display.
 * @param theme - The UI theme.
 */
function LogDisplay({ lines, theme }: LogDisplayProps) {
    const rowStyle = (idx: number) =>
        idx % 2 === 1 ? { backgroundColor: theme.well } : {};

    const lineColor = (line: string): string | undefined => {
        if (line.startsWith("ERROR:")) return theme.error;
        if (line.startsWith("SUCCESS:")) return theme.success;
        if (line.startsWith("WARN:")) return theme.warning;
        if (line.startsWith("INFO:")) return theme.info;
        return theme.success;
    };

    return (
        <div style={{ fontFamily: "monospace" }}>
            {lines.map((line, idx) => {
                const style = { ...rowStyle(idx), color: lineColor(line) };
                return <div key={idx} style={style}>{line}</div>;
            })}
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
        <tr key={worker.hostname} style={rowIndex % 2 === 1 ? { backgroundColor: theme.well } : undefined}>
            <td style={{ ...cellStyle, textAlign: "left" }}>{worker.hostname}</td>
            <td style={{ ...cellStyle, textAlign: "right" }}>{worker.totalRamStr}</td>
            <td style={{ ...cellStyle, textAlign: "right", minWidth: "215px" }}>[<MemoryBar worker={worker} theme={theme}></MemoryBar>]</td>
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
    const setAsideSeg = calculateBarSegments(setAside, worker.totalRam, segments);
    const reservedSeg = calculateBarSegments(reserved, worker.totalRam, segments);
    const allocSeg = calculateBarSegments(allocated, worker.totalRam, segments);
    const usedSeg = Math.min(segments, setAsideSeg + reservedSeg + allocSeg);
    const freeSeg = segments - usedSeg;

    const setAsideBar = "|".repeat(setAsideSeg);
    const reservedBar = "|".repeat(reservedSeg);
    const allocBar = "|".repeat(allocSeg);
    const freeBar = "-".repeat(freeSeg);

    return <>
        <span key="s" style={{ color: theme.infolight }}>{setAsideBar}</span>
        <span key="r" style={{ color: theme.hp }}>{reservedBar}</span>
        <span key="a" style={{ color: theme.money }}>{allocBar}</span>
        <span>{freeBar}</span>
    </>;
}

function calculateBarSegments(segmentRam: number, totalRam: number, segments: number): number {
    if (segmentRam > 1 && totalRam > 0) {
        const numSegments = (segmentRam / totalRam) * segments;
        return numSegments > 0 && numSegments < 1 ? 1 : Math.round(numSegments);
    } else {
        return 0;
    }
}
