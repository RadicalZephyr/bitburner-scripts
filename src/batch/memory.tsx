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
    StatusRequest,
    SnapshotRequest,
    WorkerSnapshot,
    AllocationSnapshot,
    MemorySnapshot,
} from "batch/client/memory";

import { readAllFromPort } from "util/ports";

let printLog: (msg: string) => void;

interface ClaimInfo {
    pid: number;
    hostname: string;
    filename: string;
    chunkSize: number;
    numChunks: number;
}

declare const React: any;


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
    ns.ui.resizeTail(915, 560);
    ns.ui.moveTail(1230, 650);

    const log: string[] = [];
    const maxLog = 72;
    printLog = (msg: string) => {
        log.push(msg);
        if (log.length > maxLog) {
            log.shift();
        }
    };

    let memPort = ns.getPortHandle(MEMORY_PORT);
    let memMessageWaiting = true;
    let nextMemMessage = memPort.nextWrite().then(_ => { memMessageWaiting = true; });

    let memoryManager = new MemoryManager(ns);
    printLog(`INFO: starting memory manager on ${ns.getHostname()}`);

    memoryManager.pushWorker("home", 32);

    let collectionRate = 1000 * 10;

    let lastRender = 0;
    let lastCollection = Date.now();

    while (true) {
        let now = Date.now();

        if (memMessageWaiting) {
            printLog("INFO: reading memory requests");
            readMemRequestsFromPort(ns, memPort, memoryManager);
            memMessageWaiting = false;
            nextMemMessage = memPort.nextWrite().then(_ => { memMessageWaiting = true; });
            printLog("INFO: finished reading memory requests");
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

        // N.B. this time is seconds not milliseconds
        if (lastCollection + collectionRate < now) {
            memoryManager.updateReserved();
            memoryManager.cleanupTerminated();
            lastCollection = now;
        }
        await ns.sleep(50);
    }
}

function readMemRequestsFromPort(ns: NS, memPort: NetscriptPort, memoryManager: MemoryManager) {
    for (const nextMsg of readAllFromPort(ns, memPort)) {
        let msg = nextMsg as Message;
        switch (msg[0]) {
            case MessageType.Worker:
                const hostname = msg[1] as string;
                memoryManager.pushWorker(hostname);
                break;

            case MessageType.Request:
                const request = msg[1] as AllocationRequest;
                printLog(
                    `INFO: request pid=${request.pid} ` +
                    `${request.numChunks}x${ns.formatRam(request.chunkSize)} ` +
                    `contiguous=${request.contiguous ?? false} ` +
                    `coreDependent=${request.coreDependent ?? false}`
                );
                const returnPort = request.returnPort;
                const allocation = memoryManager.allocate(
                    request.pid,
                    request.chunkSize,
                    request.numChunks,
                    request.contiguous ?? false,
                    request.coreDependent ?? false,
                );
                if (allocation) {
                    printLog(
                        `SUCCESS: allocated id ${allocation.allocationId} ` +
                        `across ${allocation.hosts.length} hosts`
                    );
                } else {
                    printLog("WARN: allocation failed, not enough space");
                }
                ns.writePort(returnPort, allocation);
                break;

            case MessageType.Release:
                const release = msg[1] as AllocationRelease;
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
                break;

            case MessageType.ReleaseChunks:
                const releaseInfo = msg[1] as AllocationChunksRelease;
                printLog(
                    `INFO: release ${releaseInfo.numChunks} chunks from ` +
                    `allocation ${releaseInfo.allocationId}`
                );
                const result = memoryManager.releaseChunks(
                    releaseInfo.allocationId,
                    releaseInfo.numChunks,
                );
                ns.writePort(releaseInfo.returnPort, result);
                break;

            case MessageType.Status:
                const statusReq = msg[1] as StatusRequest;
                const freeRam = memoryManager.getFreeRamTotal();
                ns.writePort(statusReq.returnPort, { freeRam });
                break;

            case MessageType.Snapshot:
                const snapReq = msg[1] as SnapshotRequest;
                printLog(`INFO: processing snapshot request on port ${snapReq.returnPort}`);
                const snapshot = memoryManager.getSnapshot();
                ns.writePort(snapReq.returnPort, snapshot);
                break;

            case MessageType.Claim:
                const claimInfo = msg[1] as AllocationClaim;
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
                break;
        }
    }
}

class MemoryManager {
    ns: NS;
    nextAllocId: number;
    workers: Map<string, Worker>;
    allocations: Map<number, Allocation>;

    constructor(ns: NS) {
        this.ns = ns;
        this.nextAllocId = 0;
        this.workers = new Map();
        this.allocations = new Map();
    }

    pushWorker(hostname: string, setAsideRam?: number) {
        this.workers.set(hostname, new Worker(this.ns, hostname, setAsideRam));
        printLog(
            `INFO: registered worker ${hostname} with ` +
            `${this.ns.formatRam(this.ns.getServerMaxRam(hostname))}`
        );
    }

    getFreeRamTotal(): number {
        let total = 0;
        for (const w of this.workers.values()) {
            total += w.freeRam;
        }
        return total;
    }

    cleanupTerminated(): void {
        for (const [id, allocation] of this.allocations.entries()) {
            const remaining: ClaimInfo[] = [];
            for (const claim of allocation.claims) {
                if (!this.ns.isRunning(claim.pid)) {
                    // Release the memory held by this terminated pid
                    this.releaseClaimInternal(allocation, claim);
                    printLog(
                        `INFO: reclaimed allocation ${id} ` +
                        `pid=${claim.pid} host=${claim.hostname}`,
                    );
                } else {
                    remaining.push(claim);
                }
            }
            allocation.claims = remaining;
            allocation.chunks = allocation.chunks.filter(c => c.numChunks > 0);
            if (allocation.chunks.length === 0) {
                this.allocations.delete(id);
            }
        }
    }

    /**
     * Refresh the reserved RAM on each worker host.
     */
    updateReserved(): void {
        for (const worker of this.workers.values()) {
            const actual = this.ns.getServerUsedRam(worker.hostname);
            const diff = actual - worker.allocatedRam;
            worker.reservedRam = diff > 0 ? diff : 0;
        }
    }

    getSnapshot(): MemorySnapshot {
        const workers: WorkerSnapshot[] = [];
        for (const w of this.workers.values()) {
            workers.push({
                hostname: w.hostname,
                totalRam: w.totalRam,
                setAsideRam: w.setAsideRam,
                reservedRam: w.reservedRam,
                allocatedRam: w.allocatedRam,
            });
        }

        const allocations: AllocationSnapshot[] = [];
        for (const [id, alloc] of this.allocations.entries()) {
            allocations.push({
                allocationId: id,
                pid: alloc.pid,
                hosts: alloc.chunks.map(c => c.asHostAllocation()),
                claims: alloc.claims.map(c => ({
                    pid: c.pid,
                    hostname: c.hostname,
                    filename: c.filename,
                    chunkSize: c.chunkSize,
                    numChunks: c.numChunks,
                })),
            });
        }

        return { workers, allocations };
    }

    /**
     * Allocate RAM for the given pid.
     *
     * When `coreDependent` is true the home server is preferred for
     * the allocation. Otherwise the manager will try to allocate on
     * non-home servers first.
     */
    allocate(
        pid: number,
        chunkSize: number,
        numChunks: number,
        contiguous: boolean = false,
        coreDependent: boolean = false,
    ): AllocationResult {
        let workers = Array.from(this.workers.values());

        workers.sort((a, b) => {
            if (a.hostname === "home" && b.hostname !== "home") {
                return coreDependent ? -1 : 1;
            }
            if (a.hostname !== "home" && b.hostname === "home") {
                return coreDependent ? 1 : -1;
            }
            return 0;
        });

        if (contiguous) {
            // If any worker can satisfy the full request, allocate it there.
            for (const worker of workers) {
                if (Math.floor(worker.freeRam / chunkSize) >= numChunks) {
                    const chunk = worker.allocate(chunkSize, numChunks);
                    const id = this.nextAllocId++;
                    const allocation = new Allocation(id, pid, [chunk]);
                    this.allocations.set(id, allocation);
                    return allocation.asAllocationResult();
                }
            }

            // Otherwise, sort workers by free RAM descending to minimize hosts used
            workers.sort((a, b) => {
                if (b.freeRam === a.freeRam) {
                    if (a.hostname === "home" && b.hostname !== "home") {
                        return coreDependent ? -1 : 1;
                    }
                    if (a.hostname !== "home" && b.hostname === "home") {
                        return coreDependent ? 1 : -1;
                    }
                    return 0;
                }
                return b.freeRam - a.freeRam;
            });
        }

        let chunks: AllocationChunk[] = [];
        let remainingChunks = numChunks;

        for (const worker of workers) {
            const chunk = worker.allocate(chunkSize, remainingChunks);
            if (chunk) {
                chunks.push(chunk);
                remainingChunks -= chunk.numChunks;
            }

            if (remainingChunks <= 0) break;
        }

        if (remainingChunks > 0) {
            // Roll back partial allocations
            for (const chunk of chunks) {
                this.workers.get(chunk.hostname)?.free(chunk.totalSize);
            }
            return null; // Allocation failed
        }

        const id = this.nextAllocId++;
        const allocation = new Allocation(id, pid, chunks);
        this.allocations.set(id, allocation);

        return allocation.asAllocationResult();
    }

    deallocate(id: number, pid: number, hostname: string): boolean {
        const allocation = this.allocations.get(id);
        if (!allocation) return false;

        const idx = allocation.claims.findIndex(
            (c) => c.pid === pid && c.hostname === hostname,
        );
        if (idx === -1) return false;
        const claim = allocation.claims[idx];
        this.releaseClaimInternal(allocation, claim);
        allocation.claims.splice(idx, 1);
        allocation.chunks = allocation.chunks.filter((c) => c.numChunks > 0);
        if (allocation.chunks.length === 0) {
            this.allocations.delete(id);
        }
        return true;
    }

    releaseChunks(id: number, numChunks: number): AllocationResult | null {
        const allocation = this.allocations.get(id);
        if (!allocation) return null;

        let remaining = numChunks;
        const chunks = [...allocation.chunks].sort((a, b) => {
            const freeA = this.workers.get(a.hostname)?.freeRam ?? 0;
            const freeB = this.workers.get(b.hostname)?.freeRam ?? 0;
            return freeB - freeA;
        });

        for (const chunk of chunks) {
            if (remaining <= 0) break;
            const toFree = Math.min(remaining, chunk.numChunks);
            const worker = this.workers.get(chunk.hostname);
            if (worker) {
                worker.free(chunk.chunkSize * toFree);
            }
            chunk.numChunks -= toFree;
            remaining -= toFree;

            let remainingFromClaims = toFree;
            for (const claim of allocation.claims) {
                if (remainingFromClaims <= 0) break;
                if (claim.hostname === chunk.hostname && claim.chunkSize === chunk.chunkSize) {
                    const reduce = Math.min(claim.numChunks, remainingFromClaims);
                    claim.numChunks -= reduce;
                    remainingFromClaims -= reduce;
                }
            }
        }

        allocation.chunks = allocation.chunks.filter(c => c.numChunks > 0);
        allocation.claims = allocation.claims.filter(c => c.numChunks > 0);
        if (allocation.chunks.length === 0) {
            this.allocations.delete(id);
            return null;
        }

        return allocation.asAllocationResult();
    }

    claimAllocation(claim: AllocationClaim): boolean {
        const allocation = this.allocations.get(claim.allocationId);
        if (!allocation) return false;

        const chunk = allocation.chunks.find(
            c => c.hostname === claim.hostname && c.chunkSize === claim.chunkSize,
        );
        if (!chunk) {
            printLog(
                `WARN: claim request for allocation ${claim.allocationId} on ${claim.hostname} not found`,
            );
            return false;
        }

        const claimedSoFar = allocation.claims
            .filter(c => c.hostname === claim.hostname && c.chunkSize === claim.chunkSize)
            .reduce((sum, c) => sum + c.numChunks, 0);

        if (claimedSoFar + claim.numChunks > chunk.numChunks) {
            printLog(
                `WARN: claim for allocation ${claim.allocationId} exceeds reserved chunks`,
            );
            return false;
        }

        allocation.claims.push(claim as ClaimInfo);

        return true;
    }

    /**
     * Release the RAM associated with a single claim without
     * removing it from the allocation's claim list.
     */
    private releaseClaimInternal(allocation: Allocation, claim: ClaimInfo) {
        const worker = this.workers.get(claim.hostname);
        if (worker) {
            worker.free(claim.chunkSize * claim.numChunks);
        }
        const chunk = allocation.chunks.find(
            c => c.hostname === claim.hostname && c.chunkSize === claim.chunkSize,
        );
        if (chunk) {
            chunk.numChunks -= claim.numChunks;
        }
    }
}

class Allocation {
    id: number;
    pid: number;
    chunks: AllocationChunk[];
    claims: ClaimInfo[];

    constructor(id: number, pid: number, chunks: AllocationChunk[]) {
        this.id = id;
        this.pid = pid;
        this.chunks = chunks;
        this.claims = [];
    }

    get totalSize(): number {
        return this.chunks.reduce((sum, c) => sum + c.totalSize, 0);
    }

    asAllocationResult(): AllocationResult {
        return {
            allocationId: this.id,
            hosts: this.chunks.map((chunk) => chunk.asHostAllocation()),
        };
    }
}

class AllocationChunk {
    hostname: string;
    chunkSize: number;
    numChunks: number;

    constructor(hostname: string, chunkSize: number, numChunks: number) {
        this.hostname = hostname;
        this.chunkSize = chunkSize;
        this.numChunks = numChunks;
    }

    get totalSize(): number {
        return this.chunkSize * this.numChunks;
    }

    asHostAllocation(): HostAllocation {
        return {
            hostname: this.hostname,
            chunkSize: this.chunkSize,
            numChunks: this.numChunks,
        };
    }
}

class Worker {
    ns: NS;
    hostname: string;
    totalRam: number;
    setAsideRam: number;
    reservedRam: number;
    allocatedRam: number;

    constructor(ns: NS, hostname: string, setAsideRam?: number) {
        this.ns = ns;
        this.hostname = hostname;
        this.totalRam = ns.getServerMaxRam(hostname);
        this.setAsideRam = typeof setAsideRam == "number" && setAsideRam >= 0 ? setAsideRam : 0;
        this.reservedRam = ns.getServerUsedRam(hostname);
        this.allocatedRam = 0;
    }

    get usedRam(): number {
        return this.setAsideRam + this.reservedRam + this.allocatedRam;
    }

    get freeRam(): number {
        return Math.max(0, this.totalRam - this.usedRam);
    }

    allocate(chunkSize: number, numChunks: number): AllocationChunk {
        const maxAllocatableChunks = Math.floor(this.freeRam / chunkSize);
        const chunksToAllocate = Math.min(numChunks, maxAllocatableChunks);

        if (chunksToAllocate <= 0) return null;

        const ram = chunkSize * chunksToAllocate;
        this.allocatedRam += ram;

        return new AllocationChunk(this.hostname, chunkSize, chunksToAllocate);
    }

    free(ram: number): void {
        this.allocatedRam = Math.max(0, this.allocatedRam - ram);
    }
}

interface MemoryDisplayProps {
    manager: MemoryManager;
    theme: UserInterfaceTheme;
}

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
    const setAsideSeg = Math.round((worker.setAsideRam / worker.totalRam) * segments);
    const reservedSeg = Math.round((worker.reservedRam / worker.totalRam) * segments);
    const allocSeg = Math.round((worker.allocatedRam / worker.totalRam) * segments);
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
