import type { NS } from '@ns';

import { ALLOC_ID, ALLOC_ID_ARG } from 'services/client/memory_tag';

import { defineProtocol, BaseClient } from 'util/protocol';
import { makeFuid } from 'util/fuid';
import {
    isUnionOf,
    isArrayOf,
    isBoolean,
    isLiteral,
    isNumber,
    isObjectLike,
    isOptional,
    isString,
    type Validator,
} from 'util/validate';

export const MEMORY_PORT: number = 3;
export const MEMORY_RESPONSE_PORT: number = 4;

export const MessageType = {
    Worker: 'Worker',
    AllocationRequest: 'AllocationRequest',
    GrowableRequest: 'GrowableRequest',
    Release: 'Release',
    Claim: 'Claim',
    ClaimRelease: 'ClaimRelease',
    Register: 'Register',
    Status: 'Status',
    Snapshot: 'Snapshot',
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];

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

const isAllocationRequest: Validator<AllocationRequest> = isObjectLike({
    pid: isNumber,
    filename: isString,
    chunkSize: isNumber,
    numChunks: isNumber,
    contiguous: isOptional(isBoolean),
    coreDependent: isOptional(isBoolean),
    shrinkable: isOptional(isBoolean),
    longRunning: isOptional(isBoolean),
});

export interface GrowableAllocationRequest extends AllocationRequest {
    port: number;
}

const isGrowableAllocationRequest: Validator<GrowableAllocationRequest> =
    isObjectLike({
        pid: isNumber,
        filename: isString,
        chunkSize: isNumber,
        numChunks: isNumber,
        contiguous: isOptional(isBoolean),
        coreDependent: isOptional(isBoolean),
        shrinkable: isOptional(isBoolean),
        longRunning: isOptional(isBoolean),
        port: isNumber,
    });

export interface AllocationRelease {
    allocationId: number;
    pid: number;
    hostname: string;
}

const isAllocationRelease: Validator<AllocationRelease> = isObjectLike({
    allocationId: isNumber,
    pid: isNumber,
    hostname: isString,
});

export interface AllocationClaim {
    allocationId: number;
    pid: number;
    hostname: string;
    filename: string;
    chunkSize: number;
    numChunks: number;
}

const isAllocationClaim: Validator<AllocationClaim> = isObjectLike({
    allocationId: isNumber,
    pid: isNumber,
    hostname: isString,
    filename: isString,
    chunkSize: isNumber,
    numChunks: isNumber,
});

export interface AllocationClaimRelease {
    allocationId: number;
    pid: number;
    hostname: string;
}

const isAllocationClaimRelease: Validator<AllocationClaimRelease> =
    isObjectLike({
        allocationId: isNumber,
        pid: isNumber,
        hostname: isString,
    });

export interface AllocationRegister {
    pid: number;
    hostname: string;
    filename: string;
    chunkSize: number;
    numChunks: number;
}

const isAllocationRegister: Validator<AllocationRegister> = isObjectLike({
    pid: isNumber,
    hostname: isString,
    filename: isString,
    chunkSize: isNumber,
    numChunks: isNumber,
});

export const StatusRequest = 'SMA_StatusRequest';
export type StatusRequest = typeof StatusRequest;

const isStatusRequest: Validator<StatusRequest> = isLiteral(StatusRequest);

export const SnapshotRequest = 'SMA_SnapshotRequest';
export type SnapshotRequest = typeof SnapshotRequest;

const isSnapshotRequest: Validator<SnapshotRequest> =
    isLiteral(SnapshotRequest);

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

const isWorkerSnapshot: Validator<WorkerSnapshot> = isObjectLike({
    hostname: isString,
    totalRam: isNumber,
    setAsideRam: isNumber,
    reservedRam: isNumber,
    allocatedRam: isNumber,
});

export interface ClaimSnapshot {
    pid: number;
    hostname: string;
    filename: string;
    chunkSize: number;
    numChunks: number;
}

const isClaimSnapshot: Validator<ClaimSnapshot> = isObjectLike({
    pid: isNumber,
    hostname: isString,
    filename: isString,
    chunkSize: isNumber,
    numChunks: isNumber,
});

export interface HostAllocation {
    hostname: string;
    chunkSize: number;
    numChunks: number;
}

export const isHostAllocation: Validator<HostAllocation> = isObjectLike({
    hostname: isString,
    chunkSize: isNumber,
    numChunks: isNumber,
});

export interface AllocationResult {
    allocationId: number;
    hosts: HostAllocation[];
}

const isAllocationResult: Validator<AllocationResult> = isObjectLike({
    allocationId: isNumber,
    hosts: isArrayOf(isHostAllocation),
});

export interface AllocationSnapshot {
    allocationId: number;
    pid: number;
    filename: string;
    hosts: HostAllocation[];
    claims: ClaimSnapshot[];
}

const isAllocationSnapshot: Validator<AllocationSnapshot> = isObjectLike({
    allocationId: isNumber,
    pid: isNumber,
    filename: isString,
    hosts: isArrayOf(isHostAllocation),
    claims: isArrayOf(isClaimSnapshot),
});

export interface MemorySnapshot {
    workers: WorkerSnapshot[];
    allocations: AllocationSnapshot[];
}

const isMemorySnapshot: Validator<MemorySnapshot> = isObjectLike({
    workers: isArrayOf(isWorkerSnapshot),
    allocations: isArrayOf(isAllocationSnapshot),
});

export interface FreeChunk {
    hostname: string;
    freeRam: number;
}

const isFreeChunk: Validator<FreeChunk> = isObjectLike({
    hostname: isString,
    freeRam: isNumber,
});

export interface FreeRam {
    freeRam: number;
    chunks: FreeChunk[];
}

const isFreeRam: Validator<FreeRam> = isObjectLike({
    freeRam: isNumber,
    chunks: isArrayOf(isFreeChunk),
});

export const MemoryProtocol = defineProtocol({
    [MessageType.Worker]: {
        payload: isUnionOf(isString, isArrayOf(isString)),
    },
    [MessageType.AllocationRequest]: {
        payload: isAllocationRequest,
        response: isOptional(isAllocationResult),
    },
    [MessageType.GrowableRequest]: {
        payload: isGrowableAllocationRequest,
        response: isOptional(isAllocationResult),
    },
    [MessageType.Release]: {
        payload: isAllocationRelease,
    },
    [MessageType.Claim]: {
        payload: isAllocationClaim,
    },
    [MessageType.ClaimRelease]: {
        payload: isAllocationClaimRelease,
    },
    [MessageType.Register]: {
        payload: isAllocationRegister,
    },
    [MessageType.Status]: {
        payload: isStatusRequest,
        response: isFreeRam,
    },
    [MessageType.Snapshot]: {
        payload: isSnapshotRequest,
        response: isMemorySnapshot,
    },
});

export type MemoryProtocolDef = (typeof MemoryProtocol)['def'];

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

export class MemoryClient {
    protected ns: NS;
    protected client: BaseClient<MemoryProtocolDef>;

    constructor(ns: NS) {
        this.ns = ns;
        this.client = new BaseClient(
            MemoryProtocol,
            ns.getPortHandle(MEMORY_PORT),
            ns.getPortHandle(MEMORY_RESPONSE_PORT),
        );
    }

    /**
     * Notify the MemoryAllocator of a new Worker host.
     *
     * @param hostname
     */
    async newWorker(hostname: string) {
        this.ns.print(`INFO: registering worker ${hostname}`);
        await this.client.sendMessage(MessageType.Worker, hostname);
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
     * @returns a transferable allocation or null if allocation fails
     */
    async requestTransferableAllocation(
        chunkSize: number,
        numChunks: number,
        options?: AllocOptions,
    ): Promise<TransferableAllocation | null> {
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
        const result = await this.client.sendMessageReceiveResponse(
            MessageType.AllocationRequest,
            payload,
        );
        if (!result) {
            this.ns.print('WARN: allocation request failed');
            return null;
        }

        const allocationResult = result;
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

        result.releaseAtExit(this.ns);
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
        await this.client.sendMessage(MessageType.Register, payload);
    }

    /**
     * Request a snapshot of current memory allocations.
     *
     * @returns Structure describing workers and allocations
     */
    async memorySnapshot(): Promise<MemorySnapshot> {
        this.ns.print('INFO: requesting memory snapshot');

        return await this.client.sendMessageReceiveResponse(
            MessageType.Snapshot,
            SnapshotRequest,
        );
    }

    /**
     * Request the current total free RAM across all workers.
     *
     * @returns Total free RAM across all workers
     */
    async getFreeRam(): Promise<FreeRam> {
        return await this.client.sendMessageReceiveResponse(
            MessageType.Status,
            StatusRequest,
        );
    }
}

/**
 * Register the current script as owning an allocation and
 * automatically release that allocation when the script exits.
 *
 * @param ns           - Netscript API instance
 * @param allocationId - Allocation ID to register claim on with allocator
 */
export async function registerAllocationOwnership(
    ns: NS,
    allocationId: number,
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
    ns.atExit(
        () => {
            const release: AllocationClaimRelease = {
                allocationId: allocationId,
                pid: self.pid,
                hostname: self.server,
            };
            MemoryProtocol.trySendMessage(
                memPort,
                MessageType.ClaimRelease,
                release,
            );
        },
        'registerAllocationOwnership-memoryRelease-' + makeFuid(ns),
    );

    const memPort = ns.getPortHandle(MEMORY_PORT);

    await MemoryProtocol.sendMessage(memPort, MessageType.Claim, claim);
}

/**
 * Validate the `ALLOC_ID` flag and claim the allocation if valid.
 *
 * All scripts optionally take an `--allocId` argument to
 * indicate that memory has been preallocated. This helper checks the
 * provided flags object, prints an error when the flag is not a
 * number, and registers ownership of the allocation when valid.
 *
 * @param ns         - The Netscript context
 * @param flags      - Flags returned from `ns.flags`
 * @param claimAlloc - Whether to send a claim message to the allocator for an alloc id arg
 * @returns The allocation ID if ownership was registered, otherwise `null`.
 */
export async function parseAndRegisterAlloc(
    ns: NS,
    flags: Record<string, unknown>,
    claimAlloc: boolean = true,
): Promise<number | null> {
    const allocId = flags[ALLOC_ID];
    if (allocId === undefined || allocId === -1) {
        return null;
    }
    if (typeof allocId !== 'number') {
        ns.tprint(`${ALLOC_ID_ARG} must be a number`);
        return null;
    }

    if (claimAlloc) await registerAllocationOwnership(ns, allocId);

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
        await MemoryProtocol.sendMessage(memPort, MessageType.Release, release);
    }

    releaseAtExit(ns: NS) {
        const release = this.release.bind(this, ns) as () => Promise<void>;
        ns.atExit(
            () => {
                void release();
            },
            'memoryRelease-' + makeFuid(ns),
        );
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
