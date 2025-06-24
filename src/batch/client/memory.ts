import type { NS, NetscriptPort } from "netscript";

export const MEMORY_PORT: number = 200;

export enum MessageType {
    Worker,
    Request,
    Release
}

type Payload = string | AllocationRequest | AllocationRelease;

export type Message = [
    type: MessageType,
    payload: Payload,
];

// Compact version for use over ports if needed
export interface AllocationRequest {
    returnPort: number,
    pid: number,
    chunkSize: number,
    numChunks: number,
}

export type AllocationRelease = [
    allocationId: number
];

export interface HostAllocation {
    hostname: string,
    chunkSize: number,
    numChunks: number
}

export interface AllocationResult {
    allocationId: number,
    hosts: HostAllocation[]
}

export function workerMessage(hostname: string): Message {
    return [MessageType.Worker, hostname];
}

export class MemoryClient {
    ns: NS;
    port: NetscriptPort;

    constructor(ns: NS) {
        this.ns = ns;
        this.port = ns.getPortHandle(MEMORY_PORT);
    }

    async newWorker(hostname: string) {
        await this.sendMessage(MessageType.Worker, hostname);
    }

    /** Send a message to the memory allocator requesting a chunk of
     *  memory for the current process to own.
     *
     * This method returns the allocationId that can then be passed to
     * `#.registerAllocationOwnership` to install the appropriate
     * `atExit` handler for releasing the allocation when the owning
     * process exits.
     */
    async requestTransferableAllocation(chunkSize: number, numChunks: number): Promise<TransferableAllocation> {
        let pid = this.ns.pid;
        let returnPortId = MEMORY_PORT + pid;
        let returnPort = this.ns.getPortHandle(returnPortId);

        let payload = {
            returnPort: returnPortId,
            pid: pid,
            chunkSize: chunkSize,
            numChunks: numChunks
        } as AllocationRequest;
        let request = [MessageType.Request, payload] as Message;
        while (!this.port.tryWrite(request)) {
            await this.ns.sleep(100);
        }
        await returnPort.nextWrite();
        let result = returnPort.read();
        if (!result) return null;

        let allocationResult = result as AllocationResult;
        return new TransferableAllocation(allocationResult.allocationId, allocationResult.hosts);
    }

    /** Send a message to the memory allocator requesting a chunk of
     *  memory for the current process to own.
     *
     * This method also registers an `atExit` handler function to send
     * a release message to the memory allocator.
     */
    async requestOwnedAllocation(chunkSize: number, numChunks: number): Promise<HostAllocation[]> {
        let result = await this.requestTransferableAllocation(chunkSize, numChunks);
        if (!result) {
            return null;
        }

        let allocationId = result.allocationId;
        let memoryPort = this.port;
        registerAllocationOwnership(this.ns, allocationId)
        return result.allocatedChunks;
    }

    private async sendMessage(type: MessageType, payload: Payload) {
        let message = [type, payload];
        while (!this.port.tryWrite(message)) {
            await this.ns.sleep(200);
        }
    }
}

export function registerAllocationOwnership(ns: NS, allocationId: number) {
    ns.atExit(() => {
        ns.writePort(MEMORY_PORT, [MessageType.Release, [allocationId]]);
    }, "memoryRelease");
}

export class TransferableAllocation {
    allocationId: number;
    allocatedChunks: AllocationChunk[];

    constructor(allocationId: number, allocations: HostAllocation[]) {
        this.allocationId = allocationId;
        this.allocatedChunks = allocations.map(chunk => new AllocationChunk(chunk));
    }

    releaseAtExit(ns: NS) {
        registerAllocationOwnership(ns, this.allocationId);
    }

    totalAllocatedRam(): number {
        return this.allocatedChunks.reduce((sum, chunk) => sum + chunk.totalSize, 0);
    }
}

class AllocationChunk {
    hostname: string;
    chunkSize: number;
    numChunks: number;

    constructor(chunk: HostAllocation) {
        this.hostname = chunk.hostname;
        this.chunkSize = chunk.chunkSize;
        this.numChunks = chunk.numChunks;
    }

    get totalSize(): number {
        return this.chunkSize * this.numChunks;
    }
}
