import type { NS } from "netscript";

import {
    Client,
    Message as ClientMessage,
    Response as ClientResponse,
    sendMessage,
    trySendMessage
} from "util/client";

export const MEMORY_PORT: number = 3;
export const MEMORY_RESPONSE_PORT: number = 4;

export enum MessageType {
    Worker,
    Request,
    Release,
    Claim,
    ReleaseChunks,
    Status,
    Snapshot,
}

type Payload =
    | string
    | AllocationRequest
    | AllocationRelease
    | AllocationClaim
    | AllocationChunksRelease
    | StatusRequest
    | SnapshotRequest;

type ResponsePayload = AllocationResult | FreeRam | MemorySnapshot | null;

export type Message = ClientMessage<MessageType, Payload>;

export type Response = ClientResponse<ResponsePayload>;


/**************************************************/
/** Request Types
/**************************************************/

// Compact version for use over ports if needed
export interface AllocationRequest {
    pid: number,
    filename: string,
    chunkSize: number,
    numChunks: number,
    contiguous?: boolean,
    coreDependent?: boolean,
    shrinkable?: boolean,
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
}

export interface StatusRequest {
}

export interface SnapshotRequest {
}


/**************************************************/
/** Response Types
/**************************************************/

export interface WorkerSnapshot {
    hostname: string,
    totalRam: number,
    setAsideRam: number,
    reservedRam: number,
    allocatedRam: number,
}

export interface ClaimSnapshot {
    pid: number,
    hostname: string,
    filename: string,
    chunkSize: number,
    numChunks: number,
}

export interface AllocationSnapshot {
    allocationId: number,
    pid: number,
    filename: string,
    hosts: HostAllocation[],
    claims: ClaimSnapshot[],
}

export interface MemorySnapshot {
    workers: WorkerSnapshot[],
    allocations: AllocationSnapshot[],
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

export interface FreeRam {
    freeRam: number
}

export class MemoryClient extends Client<MessageType, Payload, ResponsePayload> {
    constructor(ns: NS) {
        super(ns, MEMORY_PORT, MEMORY_RESPONSE_PORT);
    }

    /**
     * Notify the MemoryAllocator of a new Worker host.
     *
     * @param hostname
     */
    async newWorker(hostname: string) {
        this.ns.print(
            `INFO: registering worker ${hostname} with ` +
            `${this.ns.formatRam(this.ns.getServerMaxRam(hostname))}`
        );
        await this.sendMessage(MessageType.Worker, hostname);
    }

    /**
     * Request a chunk of memory for the current process to transfer.
     *
     * This method returns the allocationId that can then be passed to
     * `#.registerAllocationOwnership` to install the appropriate
     * `atExit` handler for releasing the allocation when the owning
     * process exits.
     *
     * Set `coreDependent` to `true` when the task benefits from
     * additional home cores so the memory manager can prioritize
     * allocating RAM from the `home` server.
     *
     * @param chunkSize Size in GB of the smallest chunk usable
     * @param numChunks The requested number of chunks
     * @param contiguous
     * @param coreDependent
     * @param shrinkable
     * @returns
     */
    async requestTransferableAllocation(
        chunkSize: number,
        numChunks: number,
        contiguous: boolean = false,
        coreDependent: boolean = false,
        shrinkable: boolean = false,
    ): Promise<TransferableAllocation> {
        this.ns.print(
            `INFO: requesting ${numChunks} x ${this.ns.formatRam(chunkSize)} ` +
            `contiguous=${contiguous} coreDependent=${coreDependent}`
        );
        let pid = this.ns.pid;
        let payload = {
            pid: pid,
            filename: this.ns.self().filename,
            chunkSize: chunkSize,
            numChunks: numChunks,
            contiguous: contiguous,
            coreDependent: coreDependent,
            shrinkable: shrinkable,
        } as AllocationRequest;
        let result = await this.sendMessageReceiveResponse(MessageType.Request, payload);
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

    /**
     *  Request a chunk of memory for the current process to own.
     *
     * This method also registers an `atExit` handler function to send
     * a release message to the memory allocator.
     *
     * When `coreDependent` is `true` the memory manager will try to
     * satisfy the request from the `home` server first.
     *
     * @param chunkSize Size in GB of the smallest chunk usable
     * @param numChunks The requested number of chunks
     * @param contiguous
     * @param coreDependent
     * @param shrinkable
     * @returns
     */
    async requestOwnedAllocation(
        chunkSize: number,
        numChunks: number,
        contiguous: boolean = false,
        coreDependent: boolean = false,
        shrinkable: boolean = false,
    ): Promise<HostAllocation[]> {
        let result = await this.requestTransferableAllocation(
            chunkSize,
            numChunks,
            contiguous,
            coreDependent,
            shrinkable,
        );
        if (!result) {
            return null;
        }

        result.releaseAtExit(this.ns, "Owned");
        return result.allocatedChunks;
    }

    /**
     * Signal the MemoryAllocator that this allocation can shrink by the given amount
     *
     * @param allocationId The ID for the allocation
     * @param numChunks    The number of chunks that can be released
     * @returns            An allocation result describing the new set of chunks allocated to this ID
     */
    async releaseChunks(allocationId: number, numChunks: number): Promise<AllocationResult> {
        this.ns.print(
            `INFO: releasing ${numChunks} chunks from allocation ${allocationId}`
        );

        const payload: AllocationChunksRelease = {
            allocationId,
            numChunks,
        };
        const result = await this.sendMessageReceiveResponse(MessageType.ReleaseChunks, payload);
        if (!result) {
            this.ns.print("WARN: chunk release failed");
            return null;
        }
        return result as AllocationResult;
    }

    /**
     * Request a snapshot of current memory allocations.
     *
     * @returns Structure describing workers and allocations
     */
    async memorySnapshot(): Promise<MemorySnapshot> {
        this.ns.print("INFO: requesting memory snapshot");

        const payload: SnapshotRequest = {};
        const result = await this.sendMessageReceiveResponse(MessageType.Snapshot, payload);
        if (!result) {
            this.ns.print("WARN: snapshot request failed");
            return null;
        }
        return result as MemorySnapshot;
    }

    /**
     * Request the current total free RAM across all workers.
     *
     * @returns Total free RAM across all workers
     */
    async getFreeRam(): Promise<number> {
        const payload: StatusRequest = {};
        const result = await this.sendMessageReceiveResponse(MessageType.Status, payload);
        if (!result) {
            this.ns.print("WARN: status request failed");
            return 0;
        }
        const status = result as FreeRam;
        return status.freeRam;
    }
}

/**
 * Register the current script as owning an allocation and
 * automatically release that allocation when the script exits.
 */
export async function registerAllocationOwnership(
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
        // TODO: This should really send a new `AllocationClaimRelease` message
        trySendMessage(memPort, MessageType.Release, release);
    }, "memoryRelease" + name);

    let memPort = ns.getPortHandle(MEMORY_PORT);

    await sendMessage(ns, memPort, MessageType.Claim, claim);
}

export class TransferableAllocation {
    allocationId: number;
    allocatedChunks: AllocationChunk[];

    constructor(allocationId: number, allocations: HostAllocation[]) {
        this.allocationId = allocationId;
        this.allocatedChunks = allocations.map(chunk => new AllocationChunk(chunk));
    }

    get numChunks(): number {
        return this.allocatedChunks.reduce((s, c) => s + c.numChunks, 0);
    }

    async release(ns: NS) {
        const proc = ns.self();
        const release: AllocationRelease = {
            allocationId: this.allocationId,
            pid: proc.pid,
            hostname: proc.server,
        };

        let memPort = ns.getPortHandle(MEMORY_PORT);
        sendMessage(ns, memPort, MessageType.Release, release);
    }

    releaseAtExit(ns: NS, name?: string) {
        const release = this.release.bind(this, ns);
        ns.atExit(() => { release(); }, "memoryRelease" + name);
        ns.print(`INFO: registered atExit release for allocation ${this.allocationId}`);
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
