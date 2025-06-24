import type { NS, NetscriptPort } from "netscript";

import { AllocationRelease, AllocationRequest, AllocationResult, HostAllocation, MEMORY_PORT, Message, MessageType } from "./client/memory";

import { readAllFromPort } from "/util/ports";


export async function main(ns: NS) {
    ns.disableLog("getServerUsedRam");
    ns.disableLog("ps");
    ns.ui.openTail();

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
        ns.print("waiting for next message");
        await nextMemMessage;
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
                let allocation = memoryManager.allocate(request.pid, request.chunkSize, request.numChunks);
                ns.writePort(returnPort, allocation);
                break;

            case MessageType.Release:
                let [allocationId] = msg[1] as AllocationRelease;
                ns.printf("received release message for allocation ID: %d", allocationId);
                memoryManager.deallocate(allocationId);
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

    // TODO: figure out why this method is failing
    allocate(pid: number, chunkSize: number, numChunks: number): AllocationResult {
        let chunks: AllocationChunk[] = [];
        let remainingChunks = numChunks;

        for (const worker of this.workers.values()) {
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
                this.workers.get(chunk.hostname).free(chunk.totalSize);
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
