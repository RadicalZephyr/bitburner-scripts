import type { NS, NetscriptPort, UserInterfaceTheme } from "netscript";

import {
    AllocationClaim,
    AllocationRelease,
    AllocationRequest,
    AllocationResult,
    HostAllocation,
    MEMORY_PORT,
    Message,
    MessageType,
    AllocationChunksRelease,
    WorkerSnapshot,
    AllocationSnapshot,
    MemorySnapshot,
    MEMORY_RESPONSE_PORT,
} from "services/client/memory";

import { DiscoveryClient } from "services/client/discover";

import { fromFixed, ClaimInfo, MemoryAllocator, Worker } from "services/allocator";

import { readAllFromPort } from "util/ports";

declare const React: any;


let printLog: (msg: string) => void;

export async function main(ns: NS) {
    const flags = ns.flags([
        ['refresh-rate', 1000],
        ['help', false],
    ]);

    let refreshRate = flags['refresh-rate'];
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

    ns.disableLog("ALL");
    ns.ui.openTail();
    ns.ui.setTailTitle("Memory Allocator");
    ns.ui.resizeTail(930, 560);
    ns.ui.moveTail(1220, 650);

    const log: string[] = [];
    const maxLog = 72;
    printLog = (msg: string) => {
        log.push(msg);
        if (log.length > maxLog) {
            log.shift();
        }
    };

    let memPort = ns.getPortHandle(MEMORY_PORT);
    let memResponsePort = ns.getPortHandle(MEMORY_RESPONSE_PORT);

    let memMessageWaiting = true;
    memPort.nextWrite().then(_ => { memMessageWaiting = true; });

    let memoryManager = new MemoryAllocator(ns, printLog);

    printLog(`INFO: starting memory manager on ${ns.self().server}`);

    if (ns.getServerMaxRam("home") > 32) {
        memoryManager.pushWorker("home", 32);
    } else {
        memoryManager.pushWorker("home", 8);
    }

    let discoveryClient = new DiscoveryClient(ns);

    printLog(`INFO: requesting workers from Discover service`);
    let workers = await discoveryClient.requestWorkers({ messageType: MessageType.Worker, port: MEMORY_PORT });

    printLog(`INFO: received workers from Discover service: ${workers.join(", ")}`);
    for (const worker of workers) {
        memoryManager.pushWorker(worker);
    }

    let collectionRate = 1000 * 10;

    let lastRender = 0;
    let lastCollection = Date.now();

    while (true) {
        let now = Date.now();

        if (memMessageWaiting) {
            memMessageWaiting = false;
            memPort.nextWrite().then(_ => { memMessageWaiting = true; });
            readMemRequestsFromPort(ns, memPort, memResponsePort, memoryManager);
        }

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
        await ns.sleep(50);
    }
}

function readMemRequestsFromPort(ns: NS, memPort: NetscriptPort, memResponsePort: NetscriptPort, memoryManager: MemoryAllocator) {
    for (const nextMsg of readAllFromPort(ns, memPort)) {
        let msg = nextMsg as Message;
        const requestId: string = msg[1] as string;
        let payload: any;
        switch (msg[0]) {
            case MessageType.Worker:
                const hostPayload = msg[2];
                const hosts = Array.isArray(hostPayload) ? hostPayload : [hostPayload as string];
                for (const h of hosts) {
                    memoryManager.pushWorker(h);
                }
                // Don't send a response, no one is listening.
                continue;

            case MessageType.Request:
                const request = msg[2] as AllocationRequest;
                printLog(
                    `INFO: request pid=${request.pid} filename=${request.filename} ` +
                    `${request.numChunks}x${ns.formatRam(request.chunkSize)} ` +
                    `contiguous=${request.contiguous ?? false} ` +
                    `coreDependent=${request.coreDependent ?? false}`
                );

                const allocation = memoryManager.allocate(
                    request.pid,
                    request.filename,
                    request.chunkSize,
                    request.numChunks,
                    request.contiguous ?? false,
                    request.coreDependent ?? false,
                    request.shrinkable ?? false,
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

            case MessageType.Release:
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

            case MessageType.ReleaseChunks:
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

            case MessageType.Status:
                payload = { freeRam: memoryManager.getFreeRamTotal() };
                break;

            case MessageType.Snapshot:
                printLog(`INFO: processing snapshot request ${requestId}`);
                payload = memoryManager.getSnapshot();
                break;

            case MessageType.Claim:
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
        // TODO: make this more robust when the response port is full
        memResponsePort.write([requestId, payload]);
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
    cellStyle: any;
    theme: UserInterfaceTheme;
}

function MemoryRow({ worker, rowIndex, cellStyle, theme }: MemoryRowProps) {
    return (
        <tr key={worker.hostname} style={rowIndex % 2 === 1 ? { backgroundColor: theme.well } : undefined}>
            <td style={{ ...cellStyle, textAlign: "left" }}>{worker.hostname}</td>
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

    let setAsideBar = "|".repeat(setAsideSeg);
    let reservedBar = "|".repeat(reservedSeg);
    let allocBar = "|".repeat(allocSeg);
    let freeBar = "-".repeat(freeSeg);

    return <>
        <span key="s" style={{ color: theme.infolight }}>{setAsideBar}</span>
        <span key="r" style={{ color: theme.hp }}>{reservedBar}</span>
        <span key="a" style={{ color: theme.money }}>{allocBar}</span>
        <span>{freeBar}</span>
    </>;
}

function calculateBarSegments(segmentRam: number, totalRam: number, segments: number): number {
    if (segmentRam > 1 && totalRam > 0) {
        let numSegments = (segmentRam / totalRam) * segments;
        return numSegments > 0 && numSegments < 1 ? 1 : Math.round(numSegments);
    } else {
        return 0;
    }
}
