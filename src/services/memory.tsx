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

import { readAllFromPort } from "util/ports";

const toFixed = (val: number): bigint => BigInt(Math.round(val * 100));
const fromFixed = (val: bigint): number => Number(val) / 100;

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

    let memoryManager = new MemoryAllocator(ns);

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

class MemoryAllocator {
    ns: NS;
    nextAllocId: number = 0;
    workers: Map<string, Worker> = new Map();
    allocations: Map<number, Allocation> = new Map();

    constructor(ns: NS) {
        this.ns = ns;
    }

    pushWorker(hostname: string, setAsideRam?: number) {
        if (this.workers.has(hostname)) {
            printLog(`INFO: received duplicate worker registration for ${hostname}`);
            return;
        }

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
            if (allocation.claims.length === 0 && !this.ns.isRunning(allocation.pid)) {
                for (const c of allocation.chunks) {
                    let worker = this.workers.get(c.hostname);
                    if (worker) {
                        worker.free(c.chunkSize * c.numChunks);
                    }
                }

                this.allocations.delete(id);
            }

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
            const actual = toFixed(this.ns.getServerUsedRam(worker.hostname));
            const diff = actual - worker.allocatedRam;
            worker.reservedRam = diff > 0n ? diff : 0n;
        }
    }

    getSnapshot(): MemorySnapshot {
        const workers: WorkerSnapshot[] = [];
        for (const w of this.workers.values()) {
            workers.push({
                hostname: w.hostname,
                totalRam: w.totalRam,
                setAsideRam: fromFixed(w.setAsideRam),
                reservedRam: fromFixed(w.reservedRam),
                allocatedRam: fromFixed(w.allocatedRam),
            });
        }

        const allocations: AllocationSnapshot[] = [];
        for (const [id, alloc] of this.allocations.entries()) {
            allocations.push({
                allocationId: id,
                pid: alloc.pid,
                filename: alloc.filename,
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
        filename: string,
        chunkSize: number,
        numChunks: number,
        contiguous: boolean = false,
        coreDependent: boolean = false,
    ): AllocationResult {
        if (chunkSize <= 0 || numChunks <= 0) {
            printLog("ERROR: bad allocation request, zero size");
            return null;
        }

        let workers = Array.from(this.workers.values());

        workers.sort((a, b) => {
            if (a.hostname === "home" && b.hostname !== "home") {
                return coreDependent ? -1 : 1;
            }
            if (a.hostname !== "home" && b.hostname === "home") {
                return coreDependent ? 1 : -1;
            }
            return b.freeRam - a.freeRam;
        });

        if (contiguous) {
            // If any worker can satisfy the full request, allocate it there.
            for (const worker of workers) {
                if (Math.floor(worker.freeRam / chunkSize) >= numChunks) {
                    const chunk = worker.allocate(chunkSize, numChunks);
                    const id = this.nextAllocId++;
                    const allocation = new Allocation(id, pid, filename, [chunk]);
                    this.allocations.set(id, allocation);
                    return allocation.asAllocationResult();
                }
            }
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
        const allocation = new Allocation(id, pid, filename, chunks);
        this.allocations.set(id, allocation);

        return allocation.asAllocationResult();
    }

    deallocate(id: number, pid: number, hostname: string): boolean {
        const allocation = this.allocations.get(id);
        if (!allocation) return false;

        // Released by single requesting process, release all chunks
        if (allocation.pid === pid) {
            for (const c of allocation.chunks) {
                let worker = this.workers.get(c.hostname);
                if (worker) {
                    worker.free(c.chunkSize * c.numChunks);
                }
            }
            this.allocations.delete(id);
            return true;
        }

        const idx = allocation.claims.findIndex(
            (c) => c.pid === pid && c.hostname === hostname,
        );
        if (idx === -1) {
            printLog(`WARN: couldn't find a claim for ${pid} on ${hostname} to release`);
            return false;
        }
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
    filename: string;
    chunks: AllocationChunk[];
    claims: ClaimInfo[] = [];

    constructor(id: number, pid: number, filename: string, chunks: AllocationChunk[]) {
        this.id = id;
        this.pid = pid;
        this.filename = filename;
        this.chunks = chunks;
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
    setAsideRam: bigint;
    reservedRam: bigint;
    allocatedRam: bigint = 0n;

    constructor(ns: NS, hostname: string, setAsideRam?: number) {
        this.ns = ns;
        this.hostname = hostname;
        this.totalRam = ns.getServerMaxRam(hostname);
        this.setAsideRam = typeof setAsideRam == "number" && setAsideRam >= 0 ? toFixed(setAsideRam) : 0n;
        this.reservedRam = toFixed(ns.getServerUsedRam(hostname));
    }

    get usedRam(): number {
        return fromFixed(this.setAsideRam + this.reservedRam + this.allocatedRam);
    }

    get freeRam(): number {
        return Math.max(0, this.totalRam - this.usedRam);
    }

    allocate(chunkSize: number, numChunks: number): AllocationChunk {
        const maxAllocatableChunks = Math.floor(this.freeRam / chunkSize);
        const chunksToAllocate = Math.min(numChunks, maxAllocatableChunks);

        if (chunksToAllocate <= 0) return null;

        const ram = chunkSize * chunksToAllocate;
        this.allocatedRam += toFixed(ram);

        return new AllocationChunk(this.hostname, chunkSize, chunksToAllocate);
    }

    free(ram: number): void {
        const delta = toFixed(ram);
        this.allocatedRam = this.allocatedRam >= delta ? this.allocatedRam - delta : 0n;
    }
}

interface MemoryDisplayProps {
    manager: MemoryAllocator;
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
