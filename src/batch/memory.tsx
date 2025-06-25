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
} from "batch/client/memory";

import { readAllFromPort } from "util/ports";

let printLog: (msg: string) => void;

declare const React: any;


export async function main(ns: NS) {
    const flags = ns.flags([
        ['refresh-rate', 200],
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
    ns.ui.moveTail(230, 0);

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
    printLog("starting memory manager");
    while (true) {
        if (memMessageWaiting) {
            printLog("reading memory requests");
            readMemRequestsFromPort(ns, memPort, memoryManager);
            memMessageWaiting = false;
            nextMemMessage = memPort.nextWrite().then(_ => { memMessageWaiting = true; });
            printLog("finished reading memory requests");
        }

        const theme = ns.ui.getTheme();
        ns.clearLog();
        ns.printRaw(
            <div style={{ display: "flex", gap: "1em" }}>
                <MemoryDisplay manager={memoryManager} theme={theme}></MemoryDisplay>
                <LogDisplay lines={log} theme={theme}></LogDisplay>
            </div>
        );
        if (ns.self().onlineRunningTime % 1000 == 0) {
            memoryManager.cleanupTerminated();
        }
        await ns.sleep(refreshRate);
    }
}

function readMemRequestsFromPort(ns: NS, memPort: NetscriptPort, memoryManager: MemoryManager) {
    for (const nextMsg of readAllFromPort(ns, memPort)) {
        let msg = nextMsg as Message;
        switch (msg[0]) {
            case MessageType.Worker:
                let hostname = msg[1] as string
                printLog(`got worker hostname ${hostname}`);
                memoryManager.pushWorker(hostname);
                break;

            case MessageType.Request:
                let request = msg[1] as AllocationRequest;
                printLog(`got mem request: ${JSON.stringify(request)}`);
                let returnPort = request.returnPort;
                let allocation = memoryManager.allocate(request.pid, request.chunkSize, request.numChunks, request.contiguous ?? false);
                if (allocation) {
                    printLog(`allocated id ${allocation.allocationId} across ${allocation.hosts.length} hosts`);
                } else {
                    printLog(`allocation failed, not enough space`);
                }
                ns.writePort(returnPort, allocation);
                break;

            case MessageType.Release:
                const release = msg[1] as AllocationRelease;
                printLog(
                    `received release message for allocation ID: ${release.allocationId} from pid ${release.pid}`,
                );
                memoryManager.deallocate(release.allocationId, release.pid, release.hostname);
                break;

            case MessageType.ReleaseChunks:
                let releaseInfo = msg[1] as AllocationChunksRelease;
                printLog(`received partial release message for allocation ID: ${releaseInfo.allocationId}`);
                const result = memoryManager.releaseChunks(releaseInfo.allocationId, releaseInfo.numChunks);
                ns.writePort(releaseInfo.returnPort, result);
                break;

            case MessageType.Claim:
                const claim = msg[1] as AllocationClaim;
                printLog(`received claim message for allocation ID: ${claim.allocationId} -> pid ${claim.pid}`);
                memoryManager.claimAllocation(claim);
                break;
        }
    }
}

interface AllocationClaimRecord {
    pid: number;
    hostname: string;
    filename: string;
    chunkSize: number;
    numChunks: number;
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

    pushWorker(hostname: string) {
        this.workers.set(hostname, new Worker(this.ns, hostname));
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
            for (const claim of [...allocation.claims]) {
                if (!this.ns.isRunning(claim.pid, claim.hostname)) {
                    this._releaseClaim(allocation, claim);
                }
            }
            if (allocation.claims.length === 0) {
                this.deallocate(id);
            }
        }
    }

    allocate(pid: number, chunkSize: number, numChunks: number, contiguous: boolean = false): AllocationResult {
        let workers = Array.from(this.workers.values());

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
            workers.sort((a, b) => b.freeRam - a.freeRam);
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

    deallocate(id: number, pid?: number, hostname?: string): boolean {
        const allocation = this.allocations.get(id);
        if (!allocation) return false;

        if (pid !== undefined) {
            for (const claim of [...allocation.claims]) {
                if (claim.pid === pid && claim.hostname === hostname) {
                    this._releaseClaim(allocation, claim);
                }
            }
            if (allocation.claims.length > 0) {
                return true;
            }
        }

        for (const chunk of allocation.chunks) {
            const worker = this.workers.get(chunk.hostname);
            if (worker) {
                worker.free(chunk.totalSize);
            }
        }

        allocation.claims = [];
        this.allocations.delete(id);
        return true;
    }

    releaseChunks(id: number, numChunks: number, pid?: number, hostname?: string): AllocationResult | null {
        const allocation = this.allocations.get(id);
        if (!allocation) return null;

        this._reduceClaims(allocation, numChunks, pid, hostname);
        this._freeChunks(allocation, numChunks);

        if (allocation.chunks.length === 0) {
            this.allocations.delete(id);
            return null;
        }

        return allocation.asAllocationResult();
    }

    claimAllocation(claim: AllocationClaim): boolean {
        const allocation = this.allocations.get(claim.allocationId);
        if (!allocation) return false;

        allocation.claims.push({
            pid: claim.pid,
            hostname: claim.hostname,
            filename: claim.filename,
            chunkSize: claim.chunkSize,
            numChunks: claim.numChunks,
        });
        return true;
    }

    private _releaseClaim(allocation: Allocation, claim: AllocationClaimRecord) {
        this._reduceClaims(allocation, claim.numChunks, claim.pid, claim.hostname);
        this._freeChunks(allocation, claim.numChunks);
    }

    private _reduceClaims(
        allocation: Allocation,
        numChunks: number,
        pid?: number,
        hostname?: string,
    ) {
        let remaining = numChunks;
        for (const c of [...allocation.claims]) {
            if (
                pid !== undefined &&
                (c.pid !== pid || (hostname !== undefined && c.hostname !== hostname))
            )
                continue;
            if (remaining <= 0) break;
            const toRemove = Math.min(remaining, c.numChunks);
            c.numChunks -= toRemove;
            remaining -= toRemove;
            if (c.numChunks === 0) {
                const idx = allocation.claims.indexOf(c);
                if (idx >= 0) allocation.claims.splice(idx, 1);
            }
        }
    }

    private _freeChunks(allocation: Allocation, numChunks: number) {
        let remaining = numChunks;
        const chunks = [...allocation.chunks];

        for (const chunk of chunks) {
            if (remaining <= 0) break;
            const toFree = Math.min(remaining, chunk.numChunks);
            const worker = this.workers.get(chunk.hostname);
            if (worker) {
                worker.free(chunk.chunkSize * toFree);
            }
            chunk.numChunks -= toFree;
            remaining -= toFree;
        }

        allocation.chunks = allocation.chunks.filter(c => c.numChunks > 0);
    }
}

class Allocation {
    id: number;
    chunks: AllocationChunk[];
    claims: AllocationClaimRecord[];

    constructor(id: number, pid: number, chunks: AllocationChunk[]) {
        this.id = id;
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
    reservedRam: number;
    allocatedRam: number;

    constructor(ns: NS, hostname: string) {
        this.ns = ns;
        this.hostname = hostname;
        this.totalRam = ns.getServerMaxRam(hostname);
        this.reservedRam = ns.getServerUsedRam(hostname);
        this.allocatedRam = 0;
    }

    get usedRam(): number {
        return this.reservedRam + this.allocatedRam;
    }

    get freeRam(): number {
        return this.totalRam - this.usedRam;
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
    const workers = Array.from(manager.workers.values()).sort((a, b) => a.hostname.localeCompare(b.hostname));
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
    const rowStyle = (idx: number) => idx % 2 === 1 ? { backgroundColor: theme.well } : undefined;
    return (
        <div style={{ fontFamily: "monospace" }}>
            {lines.map((line, idx) =>
                <div key={idx} style={rowStyle(idx)}>{line}</div>
            )}
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
    const reservedSeg = Math.round((worker.reservedRam / worker.totalRam) * segments);
    const allocSeg = Math.round((worker.allocatedRam / worker.totalRam) * segments);
    const usedSeg = Math.min(segments, reservedSeg + allocSeg);
    const freeSeg = segments - usedSeg;

    let reservedBar = "";
    for (let i = 0; i < reservedSeg; i++) {
        reservedBar += "|";
    }
    let allocBar = "";
    for (let i = 0; i < allocSeg; i++) {
        allocBar += "|";
    }
    let freeBar = "";
    for (let i = 0; i < freeSeg; i++) {
        freeBar += "-";
    }
    return <>
        <span key="r" style={{ color: theme.hp }}>{reservedBar}</span>
        <span key="a" style={{ color: theme.money }}>{allocBar}</span>
        <span>{freeBar}</span>
    </>;
}
