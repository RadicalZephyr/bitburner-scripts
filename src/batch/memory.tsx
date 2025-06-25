import type { NS, NetscriptPort, UserInterfaceTheme } from "netscript";

import { AllocationClaim, AllocationRelease, AllocationRequest, AllocationResult, HostAllocation, MEMORY_PORT, Message, MessageType } from "batch/client/memory";

import { readAllFromPort } from "util/ports";

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

    ns.disableLog("getServerUsedRam");
    ns.disableLog("ps");
    ns.ui.openTail();
    ns.ui.moveTail(500, 0);

    let memPort = ns.getPortHandle(MEMORY_PORT);
    let memMessageWaiting = true;
    let nextMemMessage = memPort.nextWrite().then(_ => { memMessageWaiting = true; });

    let memoryManager = new MemoryManager(ns);
    ns.print("starting memory manager");
    while (true) {
        if (memMessageWaiting) {
            ns.print("reading memory requests");
            readMemRequestsFromPort(ns, memPort, memoryManager);
            memMessageWaiting = false;
            nextMemMessage = memPort.nextWrite().then(_ => { memMessageWaiting = true; });
            ns.print("finished reading memory requests");
        }

        const theme = ns.ui.getTheme();
        ns.clearLog();
        ns.printRaw(<MemoryDisplay manager={memoryManager} theme={theme}></MemoryDisplay>);
        await ns.sleep(refreshRate);
    }
}

function readMemRequestsFromPort(ns: NS, memPort: NetscriptPort, memoryManager: MemoryManager) {
    for (const nextMsg of readAllFromPort(ns, memPort)) {
        let msg = nextMsg as Message;
        switch (msg[0]) {
            case MessageType.Worker:
                let hostname = msg[1] as string
                ns.printf("got worker hostname %s", hostname);
                memoryManager.pushWorker(hostname);
                break;

            case MessageType.Request:
                let request = msg[1] as AllocationRequest;
                ns.printf("got mem request: %s", JSON.stringify(request));
                let returnPort = request.returnPort;
                let allocation = memoryManager.allocate(request.pid, request.chunkSize, request.numChunks, request.contiguous ?? false);
                if (allocation) {
                    ns.printf("allocated id %d across %d hosts", allocation.allocationId, allocation.hosts.length)
                } else {
                    ns.printf("allocation failed, not enough space");
                }
                ns.writePort(returnPort, allocation);
                break;

            case MessageType.Release:
                let [allocationId] = msg[1] as AllocationRelease;
                ns.printf("received release message for allocation ID: %d", allocationId);
                memoryManager.deallocate(allocationId);
                break;

            case MessageType.Claim:
                let [claimId, pid] = msg[1] as AllocationClaim;
                ns.printf("received claim message for allocation ID: %d -> pid %d", claimId, pid);
                memoryManager.claimAllocation(claimId, pid);
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
            if (!this.ns.isRunning(allocation.pid)) {
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

    deallocate(id: number): boolean {
        const allocation = this.allocations.get(id);
        if (!allocation) return false;

        for (const chunk of allocation.chunks) {
            const worker = this.workers.get(chunk.hostname);
            if (worker) {
                worker.free(chunk.totalSize);
            }
        }

        this.allocations.delete(id);
        return true;
    }

    claimAllocation(id: number, pid: number): boolean {
        const allocation = this.allocations.get(id);
        if (!allocation) return false;

        allocation.pid = pid;
        return true;
    }
}

class Allocation {
    id: number;
    pid: number;
    chunks: AllocationChunk[];

    constructor(id: number, pid: number, chunks: AllocationChunk[]) {
        this.id = id;
        this.pid = pid;
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
    return (
        <div style={{ fontFamily: "monospace" }}>
            {workers.map(w => <MemoryRow worker={w} theme={theme}></MemoryRow>)}
        </div>
    );
}

interface MemoryRowProps {
    worker: Worker;
    theme: UserInterfaceTheme;
}

function MemoryRow({ worker, theme }: MemoryRowProps) {
    return (
        <div>{worker.hostname} [<MemoryBar worker={worker} theme={theme}></MemoryBar>]</div>
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

    const bar: any[] = [];
    for (let i = 0; i < reservedSeg && bar.length < segments; i++) {
        bar.push(<span key={"r" + i} style={{ color: theme.infolight }}>|</span>);
    }
    for (let i = 0; i < allocSeg && bar.length < segments; i++) {
        bar.push(<span key={"a" + i} style={{ color: theme.primarylight }}>|</span>);
    }
    for (let i = 0; i < freeSeg && bar.length < segments; i++) {
        bar.push("-");
    }

    return <>{bar}</>;
}
