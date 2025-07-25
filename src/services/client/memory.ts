import type { NS } from 'netscript';

import { ALLOC_ID, ALLOC_ID_ARG } from 'services/client/memory_tag';

import {
    Client,
    Message as ClientMessage,
    Response as ClientResponse,
    sendMessage,
    trySendMessage,
} from 'util/client';

export const MEMORY_PORT: number = 3;
export const MEMORY_RESPONSE_PORT: number = 4;

export enum MessageType {
    Worker,
    Request,
    GrowableRequest,
    Release,
    Claim,
    ClaimRelease,
    ReleaseChunks,
    Register,
    Status,
    Snapshot,
}

type Payload =
    | string
    | AllocationRequest
    | GrowableAllocationRequest
    | AllocationRelease
    | AllocationClaim
    | AllocationClaimRelease
    | AllocationChunksRelease
    | AllocationRegister
    | StatusRequest
    | SnapshotRequest;

export type ResponsePayload =
    | AllocationResult
    | FreeRam
    | MemorySnapshot
    | null;

export type Message = ClientMessage<MessageType, Payload>;

export type Response = ClientResponse<ResponsePayload>;

/**************************************************/
/** Request Types
/**************************************************/

// Compact version for use over ports if needed
export interface AllocationRequest {
    pid: number;
    filename: string;
    chunkSize: number;
    numChunks: number;
    contiguous?: boolean;
    coreDependent?: boolean;
    shrinkable?: boolean;
    longRunning?: boolean;
}

export interface GrowableAllocationRequest extends AllocationRequest {
    port: number;
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

export interface AllocationClaimRelease {
    allocationId: number;
    pid: number;
    hostname: string;
}

export interface AllocationChunksRelease {
    allocationId: number;
    numChunks: number;
}

export interface AllocationRegister {
    pid: number;
    hostname: string;
    filename: string;
    chunkSize: number;
    numChunks: number;
}

export type StatusRequest = object;

export type SnapshotRequest = object;

/**************************************************/
/** Response Types
/**************************************************/

export interface WorkerSnapshot {
    hostname: string;
    totalRam: number;
    setAsideRam: number;
    reservedRam: number;
    allocatedRam: number;
}

export interface ClaimSnapshot {
    pid: number;
    hostname: string;
    filename: string;
    chunkSize: number;
    numChunks: number;
}

export interface AllocationSnapshot {
    allocationId: number;
    pid: number;
    filename: string;
    hosts: HostAllocation[];
    claims: ClaimSnapshot[];
}

export interface MemorySnapshot {
    workers: WorkerSnapshot[];
    allocations: AllocationSnapshot[];
}

export interface HostAllocation {
    hostname: string;
    chunkSize: number;
    numChunks: number;
}

export interface AllocationResult {
    allocationId: number;
    hosts: HostAllocation[];
}

export interface FreeChunk {
    hostname: string;
    freeRam: number;
}

export interface FreeRam {
    freeRam: number;
    chunks: FreeChunk[];
}

/**
 * Optional flags to request specific allocation strategies.
 *
 * contiguous:    Request a single contiguous allocation if possible
 * coreDependent: Request allocation on servers with a higher core count
 * shrinkable:    Signal that an allocation of fewer chunks than requested is okay
 * longRunning:   Prefer non-home servers for long running tasks
 */
export interface AllocOptions {
    contiguous?: boolean;
    coreDependent?: boolean;
    shrinkable?: boolean;
    longRunning?: boolean;
}

export class MemoryClient extends Client<
    MessageType,
    Payload,
    ResponsePayload
> {
    constructor(ns: NS) {
        super(ns, MEMORY_PORT, MEMORY_RESPONSE_PORT);
    }

    /**
     * Notify the MemoryAllocator of a new Worker host.
     *
     * @param hostname
     */
    async newWorker(hostname: string) {
        this.ns.print(`INFO: registering worker ${hostname}`);
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
     * @see AllocOptions for details about flags that affect
     * allocation strategy.
     *
     * @param chunkSize Size in GB of the smallest chunk usable
     * @param numChunks The requested number of chunks
     * @param options   Requests about how the MemoryAllocator chooses chunks
     * @returns
     */
    async requestTransferableAllocation(
        chunkSize: number,
        numChunks: number,
        options?: AllocOptions,
    ): Promise<TransferableAllocation> {
        const contiguous = options?.contiguous ?? false;
        const coreDependent = options?.coreDependent ?? false;
        const shrinkable = options?.shrinkable ?? false;
        const longRunning = options?.longRunning ?? false;

        this.ns.print(
            `INFO: requesting ${numChunks} x ${this.ns.formatRam(chunkSize)} `
                + `contiguous=${contiguous} coreDependent=${coreDependent} `
                + `shrinkable=${shrinkable} longRunning=${longRunning}`,
        );
        const pid = this.ns.pid;
        const payload = {
            pid: pid,
            filename: this.ns.self().filename,
            chunkSize: chunkSize,
            numChunks: numChunks,
            contiguous: contiguous,
            coreDependent: coreDependent,
            shrinkable: shrinkable,
            longRunning: longRunning,
        } as AllocationRequest;
        const result = await this.sendMessageReceiveResponse(
            MessageType.Request,
            payload,
        );
        if (!result) {
            this.ns.print('WARN: allocation request failed');
            return null;
        }

        const allocationResult = result as AllocationResult;
        const allocatedChunkSize = allocationResult.hosts[0]?.chunkSize;
        const allocatedNumChunks = allocationResult.hosts.reduce(
            (sum, chunk) => sum + chunk.numChunks,
            0,
        );
        this.ns.print(
            `SUCCESS: allocated id ${allocationResult.allocationId} `
                + `${allocatedNumChunks}x${this.ns.formatRam(allocatedChunkSize)} `
                + `on ${allocationResult.hosts.length} hosts`,
        );
        return new TransferableAllocation(
            allocationResult.allocationId,
            allocationResult.hosts,
        );
    }

    /**
     *  Request a chunk of memory for the current process to own.
     *
     * This method also registers an `atExit` handler function to send
     * a release message to the memory allocator.
     *
     * @see AllocOptions for details about flags that affect
     * allocation strategy.
     *
     * @param chunkSize Size in GB of the smallest chunk usable
     * @param numChunks The requested number of chunks
     * @param options   Requests about how the MemoryAllocator chooses chunks
     * @returns
     */
    async requestOwnedAllocation(
        chunkSize: number,
        numChunks: number,
        options?: AllocOptions,
    ): Promise<HostAllocation[]> {
        const result = await this.requestTransferableAllocation(
            chunkSize,
            numChunks,
            options,
        );
        if (!result) {
            return null;
        }

        result.releaseAtExit(this.ns, 'Owned');
        return result.allocatedChunks;
    }

    /**
     * Register an already running script's memory allocation with the
     * allocator service.
     *
     * @param hostname - The host the process is running on.
     * @param chunkSize - Memory usage of the process.
     * @param numChunks - Thread count for the process.
     * @returns Allocation information describing the registered memory.
     */
    async registerAllocation(
        hostname: string,
        chunkSize: number,
        numChunks: number = 1,
    ): Promise<void> {
        const self = this.ns.self();
        const payload: AllocationRegister = {
            pid: self.pid,
            hostname,
            filename: self.filename,
            chunkSize,
            numChunks,
        };
        await this.sendMessage(MessageType.Register, payload);
    }

    /**
     * Signal the MemoryAllocator that this allocation can shrink by the given amount
     *
     * @param allocationId The ID for the allocation
     * @param numChunks    The number of chunks that can be released
     * @returns            An allocation result describing the new set of chunks allocated to this ID
     */
    async releaseChunks(
        allocationId: number,
        numChunks: number,
    ): Promise<AllocationResult> {
        this.ns.print(
            `INFO: releasing ${numChunks} chunks from allocation ${allocationId}`,
        );

        const payload: AllocationChunksRelease = {
            allocationId,
            numChunks,
        };
        const result = await this.sendMessageReceiveResponse(
            MessageType.ReleaseChunks,
            payload,
        );
        if (!result) {
            this.ns.print('WARN: chunk release failed');
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
        this.ns.print('INFO: requesting memory snapshot');

        const payload: SnapshotRequest = {};
        const result = await this.sendMessageReceiveResponse(
            MessageType.Snapshot,
            payload,
        );
        if (!result) {
            this.ns.print('WARN: snapshot request failed');
            return null;
        }
        return result as MemorySnapshot;
    }

    /**
     * Request the current total free RAM across all workers.
     *
     * @returns Total free RAM across all workers
     */
    async getFreeRam(): Promise<FreeRam> {
        const payload: StatusRequest = {};
        const result = await this.sendMessageReceiveResponse(
            MessageType.Status,
            payload,
        );
        if (!result) {
            this.ns.print('WARN: status request failed');
            return { freeRam: 0, chunks: [] };
        }
        const status = result as FreeRam;
        return status;
    }
}

/**
 * Register the current script as owning an allocation and
 * automatically release that allocation when the script exits.
 */
export async function registerAllocationOwnership(
    ns: NS,
    allocationId: number,
    name: string = '',
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
        `INFO: claiming allocation ${allocationId} `
            + `pid=${claim.pid} host=${claim.hostname} `
            + `${claim.numChunks}x${ns.formatRam(claim.chunkSize)} `
            + `${claim.filename}`,
    );
    ns.atExit(() => {
        const release: AllocationClaimRelease = {
            allocationId: allocationId,
            pid: self.pid,
            hostname: self.server,
        };
        trySendMessage(memPort, MessageType.ClaimRelease, release);
    }, 'memoryRelease' + name);

    const memPort = ns.getPortHandle(MEMORY_PORT);

    await sendMessage(ns, memPort, MessageType.Claim, claim);
}

/**
 * Validate the `ALLOC_ID` flag and claim the allocation if valid.
 *
 * All scripts optionally take an `--allocId` argument to
 * indicate that memory has been preallocated. This helper checks the
 * provided flags object, prints an error when the flag is not a
 * number, and registers ownership of the allocation when valid.
 *
 * @param ns    - The Netscript context
 * @param flags - Flags returned from `ns.flags`
 * @param name  - Optional name to tag the allocation release handler
 * @returns     The allocation ID if ownership was registered, otherwise `null`.
 */
export async function parseAndRegisterAlloc(
    ns: NS,
    flags: Record<string, unknown>,
    name = 'self',
): Promise<number | null> {
    const allocId = flags[ALLOC_ID];
    if (allocId === undefined || allocId === -1) {
        return null;
    }
    if (typeof allocId !== 'number') {
        ns.tprint(`${ALLOC_ID_ARG} must be a number`);
        return null;
    }

    await registerAllocationOwnership(ns, allocId, name);
    return allocId;
}

export class TransferableAllocation {
    allocationId: number;
    allocatedChunks: AllocationChunk[];

    constructor(allocationId: number, allocations: HostAllocation[]) {
        this.allocationId = allocationId;
        this.allocatedChunks = allocations.map(
            (chunk) => new AllocationChunk(chunk),
        );
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

        const memPort = ns.getPortHandle(MEMORY_PORT);
        sendMessage(ns, memPort, MessageType.Release, release);
    }

    releaseAtExit(ns: NS, name?: string) {
        const release = this.release.bind(this, ns);
        ns.atExit(() => {
            release();
        }, 'memoryRelease' + name);
        ns.print(
            `INFO: registered atExit release for allocation ${this.allocationId}`,
        );
    }

    totalAllocatedRam(): number {
        return this.allocatedChunks.reduce(
            (sum, chunk) => sum + chunk.totalSize,
            0,
        );
    }
}

export class AllocationChunk {
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
