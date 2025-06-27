import type { NS, NetscriptPort } from "netscript";

export const MEMORY_PORT: number = 200;

export enum MessageType {
    Worker,
    Request,
    Release,
    Claim,
    ReleaseChunks,
}

type Payload =
    | string
    | AllocationRequest
    | AllocationRelease
    | AllocationClaim
    | AllocationChunksRelease;

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
    contiguous?: boolean,
    coreDependent?: boolean,
}

export interface AllocationRelease {
    allocationId: number;
    pid: number;
    hostname: string;
}

export interface AllocationClaim {
    allocationId: number;
    pid: number;
    hostname: string;
    filename: string;
    chunkSize: number;
    numChunks: number;
}

export interface AllocationChunksRelease {
    allocationId: number,
    numChunks: number,
    returnPort: number,
}

export interface HostAllocation {
    hostname: string,
    chunkSize: number,
    numChunks: number
}

export interface AllocationResult {
    allocationId: number,
    hosts: HostAllocation[]
}

export class MemoryClient {
    ns: NS;
    port: NetscriptPort;

    constructor(ns: NS) {
        this.ns = ns;
        this.port = ns.getPortHandle(MEMORY_PORT);
    }

    async newWorker(hostname: string) {
        this.ns.print(
            `INFO: registering worker ${hostname} with ` +
            `${this.ns.formatRam(this.ns.getServerMaxRam(hostname))}`
        );
        await this.sendMessage(MessageType.Worker, hostname);
    }

    /** Send a message to the memory allocator requesting a chunk of
     *  memory for the current process to own.
     *
     * This method returns the allocationId that can then be passed to
     * `#.registerAllocationOwnership` to install the appropriate
     * `atExit` handler for releasing the allocation when the owning
     * process exits.
     *
     * Set `coreDependent` to `true` when the task benefits from
     * additional home cores so the memory manager can prioritize
     * allocating RAM from the `home` server.
     */
    async requestTransferableAllocation(
        chunkSize: number,
        numChunks: number,
        contiguous: boolean = false,
        coreDependent: boolean = false,
    ): Promise<TransferableAllocation> {
        this.ns.print(
            `INFO: requesting ${numChunks} x ${this.ns.formatRam(chunkSize)} ` +
            `contiguous=${contiguous} coreDependent=${coreDependent}`
        );
        let pid = this.ns.pid;
        let returnPortId = MEMORY_PORT + pid;
        let returnPort = this.ns.getPortHandle(returnPortId);

        let payload = {
            returnPort: returnPortId,
            pid: pid,
            chunkSize: chunkSize,
            numChunks: numChunks,
            contiguous: contiguous,
            coreDependent: coreDependent,
        } as AllocationRequest;
        let request = [MessageType.Request, payload] as Message;
        while (!this.port.tryWrite(request)) {
            await this.ns.sleep(100);
        }
        await returnPort.nextWrite();
        let result = returnPort.read();
        if (!result) {
            this.ns.print("WARN: allocation request failed");
            return null;
        }

        let allocationResult = result as AllocationResult;
        let allocatedChunkSize = allocationResult.hosts[0]?.chunkSize;
        let allocatedNumChunks = allocationResult.hosts.reduce((sum, chunk) => sum + chunk.numChunks, 0);
        this.ns.print(
            `SUCCESS: allocated id ${allocationResult.allocationId} ` +
            `${allocatedNumChunks}x${this.ns.formatRam(allocatedChunkSize)} ` +
            `on ${allocationResult.hosts.length} hosts`
        );
        return new TransferableAllocation(
            allocationResult.allocationId,
            allocationResult.hosts
        );
    }

    /** Send a message to the memory allocator requesting a chunk of
     *  memory for the current process to own.
     *
     * This method also registers an `atExit` handler function to send
     * a release message to the memory allocator.
     *
     * When `coreDependent` is `true` the memory manager will try to
     * satisfy the request from the `home` server first.
     */
    async requestOwnedAllocation(
        chunkSize: number,
        numChunks: number,
        contiguous: boolean = false,
        coreDependent: boolean = false,
    ): Promise<HostAllocation[]> {
        let result = await this.requestTransferableAllocation(
            chunkSize,
            numChunks,
            contiguous,
            coreDependent,
        );
        if (!result) {
            return null;
        }

        result.releaseAtExit(this.ns, "Owned");
        return result.allocatedChunks;
    }

    async releaseChunks(allocationId: number, numChunks: number): Promise<AllocationResult> {
        const returnPortId = MEMORY_PORT + this.ns.pid;
        const returnPort = this.ns.getPortHandle(returnPortId);

        this.ns.print(
            `INFO: releasing ${numChunks} chunks from allocation ${allocationId}`
        );

        const payload: AllocationChunksRelease = {
            allocationId,
            numChunks,
            returnPort: returnPortId,
        };

        await this.sendMessage(MessageType.ReleaseChunks, payload);
        await returnPort.nextWrite();
        const result = returnPort.read();
        if (!result) {
            this.ns.print("WARN: chunk release failed");
            return null;
        }
        return result as AllocationResult;
    }

    private async sendMessage(type: MessageType, payload: Payload) {
        let message = [type, payload];
        while (!this.port.tryWrite(message)) {
            await this.ns.sleep(200);
        }
    }
}

/**
 * Register the current script as owning an allocation and
 * automatically release that allocation when the script exits.
 */
export function registerAllocationOwnership(
    ns: NS,
    allocationId: number,
    name: string = "",
) {
    const self = ns.self();
    const claim: AllocationClaim = {
        allocationId: allocationId,
        pid: self.pid,
        hostname: self.server,
        filename: self.filename,
        chunkSize: self.ramUsage,
        numChunks: self.threads,
    };
    ns.writePort(MEMORY_PORT, [MessageType.Claim, claim]);
    ns.print(
        `INFO: claiming allocation ${allocationId} ` +
        `pid=${claim.pid} host=${claim.hostname} ` +
        `${claim.numChunks}x${ns.formatRam(claim.chunkSize)} ` +
        `${claim.filename}`,
    );
    ns.atExit(() => {
        const release: AllocationRelease = {
            allocationId: allocationId,
            pid: self.pid,
            hostname: self.server,
        };
        ns.writePort(MEMORY_PORT, [MessageType.Release, release]);
    }, "memoryRelease" + name);
}

export class TransferableAllocation {
    allocationId: number;
    allocatedChunks: AllocationChunk[];

    constructor(allocationId: number, allocations: HostAllocation[]) {
        this.allocationId = allocationId;
        this.allocatedChunks = allocations.map(chunk => new AllocationChunk(chunk));
    }

    releaseAtExit(ns: NS, name?: string) {
        const self = ns.self();
        let allocationId = this.allocationId;
        ns.atExit(() => {
            const release: AllocationRelease = {
                allocationId: allocationId,
                pid: self.pid,
                hostname: self.server,
            };
            ns.writePort(MEMORY_PORT, [MessageType.Release, release]);
        }, "memoryRelease" + name);
        ns.print(`INFO: registered atExit release for allocation ${allocationId}`);
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
