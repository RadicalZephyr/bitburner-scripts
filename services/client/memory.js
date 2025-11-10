import { ALLOC_ID, ALLOC_ID_ARG } from 'services/client/memory_tag';
import { defineProtocol, BaseClient } from 'util/protocol';
import { makeFuid } from 'util/fuid';
import { isUnionOf, isArrayOf, isBoolean, isLiteral, isNumber, isObjectLike, isOptional, isString, } from 'util/validate';
export const MEMORY_PORT = 3;
export const MEMORY_RESPONSE_PORT = 4;
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
};
const isAllocationRequest = isObjectLike({
    pid: isNumber,
    filename: isString,
    chunkSize: isNumber,
    numChunks: isNumber,
    contiguous: isOptional(isBoolean),
    coreDependent: isOptional(isBoolean),
    shrinkable: isOptional(isBoolean),
    longRunning: isOptional(isBoolean),
});
const isGrowableAllocationRequest = isObjectLike({
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
const isAllocationRelease = isObjectLike({
    allocationId: isNumber,
    pid: isNumber,
    hostname: isString,
});
const isAllocationClaim = isObjectLike({
    allocationId: isNumber,
    pid: isNumber,
    hostname: isString,
    filename: isString,
    chunkSize: isNumber,
    numChunks: isNumber,
});
const isAllocationClaimRelease = isObjectLike({
    allocationId: isNumber,
    pid: isNumber,
    hostname: isString,
});
const isAllocationRegister = isObjectLike({
    pid: isNumber,
    hostname: isString,
    filename: isString,
    chunkSize: isNumber,
    numChunks: isNumber,
});
export const StatusRequest = 'SMA_StatusRequest';
const isStatusRequest = isLiteral(StatusRequest);
export const SnapshotRequest = 'SMA_SnapshotRequest';
const isSnapshotRequest = isLiteral(SnapshotRequest);
const isWorkerSnapshot = isObjectLike({
    hostname: isString,
    totalRam: isNumber,
    setAsideRam: isNumber,
    reservedRam: isNumber,
    allocatedRam: isNumber,
});
const isClaimSnapshot = isObjectLike({
    pid: isNumber,
    hostname: isString,
    filename: isString,
    chunkSize: isNumber,
    numChunks: isNumber,
});
export const isHostAllocation = isObjectLike({
    hostname: isString,
    chunkSize: isNumber,
    numChunks: isNumber,
});
const isAllocationResult = isObjectLike({
    allocationId: isNumber,
    hosts: isArrayOf(isHostAllocation),
});
const isAllocationSnapshot = isObjectLike({
    allocationId: isNumber,
    pid: isNumber,
    filename: isString,
    hosts: isArrayOf(isHostAllocation),
    claims: isArrayOf(isClaimSnapshot),
});
const isMemorySnapshot = isObjectLike({
    workers: isArrayOf(isWorkerSnapshot),
    allocations: isArrayOf(isAllocationSnapshot),
});
const isFreeChunk = isObjectLike({
    hostname: isString,
    freeRam: isNumber,
});
const isFreeRam = isObjectLike({
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
export class MemoryClient {
    ns;
    client;
    constructor(ns) {
        this.ns = ns;
        this.client = new BaseClient(MemoryProtocol, ns.getPortHandle(MEMORY_PORT), ns.getPortHandle(MEMORY_RESPONSE_PORT));
    }
    /**
     * Notify the MemoryAllocator of a new Worker host.
     *
     * @param hostname
     */
    async newWorker(hostname) {
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
    async requestTransferableAllocation(chunkSize, numChunks, options) {
        const contiguous = options?.contiguous ?? false;
        const coreDependent = options?.coreDependent ?? false;
        const shrinkable = options?.shrinkable ?? false;
        const longRunning = options?.longRunning ?? false;
        this.ns.print(`INFO: requesting ${numChunks} x ${this.ns.formatRam(chunkSize)} `
            + `contiguous=${contiguous} coreDependent=${coreDependent} `
            + `shrinkable=${shrinkable} longRunning=${longRunning}`);
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
        };
        const result = await this.client.sendMessageReceiveResponse(MessageType.AllocationRequest, payload);
        if (!result) {
            this.ns.print('WARN: allocation request failed');
            return null;
        }
        const allocationResult = result;
        const allocatedChunkSize = allocationResult.hosts[0]?.chunkSize;
        const allocatedNumChunks = allocationResult.hosts.reduce((sum, chunk) => sum + chunk.numChunks, 0);
        this.ns.print(`SUCCESS: allocated id ${allocationResult.allocationId} `
            + `${allocatedNumChunks}x${this.ns.formatRam(allocatedChunkSize)} `
            + `on ${allocationResult.hosts.length} hosts`);
        return new TransferableAllocation(allocationResult.allocationId, allocationResult.hosts);
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
    async requestOwnedAllocation(chunkSize, numChunks, options) {
        const result = await this.requestTransferableAllocation(chunkSize, numChunks, options);
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
    async registerAllocation(hostname, chunkSize, numChunks = 1) {
        const self = this.ns.self();
        const payload = {
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
    async memorySnapshot() {
        this.ns.print('INFO: requesting memory snapshot');
        return await this.client.sendMessageReceiveResponse(MessageType.Snapshot, SnapshotRequest);
    }
    /**
     * Request the current total free RAM across all workers.
     *
     * @returns Total free RAM across all workers
     */
    async getFreeRam() {
        return await this.client.sendMessageReceiveResponse(MessageType.Status, StatusRequest);
    }
}
/**
 * Register the current script as owning an allocation and
 * automatically release that allocation when the script exits.
 *
 * @param ns           - Netscript API instance
 * @param allocationId - Allocation ID to register claim on with allocator
 */
export async function registerAllocationOwnership(ns, allocationId) {
    const self = ns.self();
    const claim = {
        allocationId: allocationId,
        pid: self.pid,
        hostname: self.server,
        filename: self.filename,
        chunkSize: self.ramUsage,
        numChunks: self.threads,
    };
    ns.print(`INFO: claiming allocation ${allocationId} `
        + `pid=${claim.pid} host=${claim.hostname} `
        + `${claim.numChunks}x${ns.formatRam(claim.chunkSize)} `
        + `${claim.filename}`);
    ns.atExit(() => {
        const release = {
            allocationId: allocationId,
            pid: self.pid,
            hostname: self.server,
        };
        MemoryProtocol.trySendMessage(memPort, MessageType.ClaimRelease, release);
    }, 'registerAllocationOwnership-memoryRelease-' + makeFuid(ns));
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
export async function parseAndRegisterAlloc(ns, flags, claimAlloc = true) {
    const allocId = flags[ALLOC_ID];
    if (allocId === undefined || allocId === -1) {
        return null;
    }
    if (typeof allocId !== 'number') {
        ns.tprint(`${ALLOC_ID_ARG} must be a number`);
        return null;
    }
    if (claimAlloc)
        await registerAllocationOwnership(ns, allocId);
    return allocId;
}
export class TransferableAllocation {
    allocationId;
    allocatedChunks;
    constructor(allocationId, allocations) {
        this.allocationId = allocationId;
        this.allocatedChunks = allocations.map((chunk) => new AllocationChunk(chunk));
    }
    get numChunks() {
        return this.allocatedChunks.reduce((s, c) => s + c.numChunks, 0);
    }
    async release(ns) {
        const proc = ns.self();
        const release = {
            allocationId: this.allocationId,
            pid: proc.pid,
            hostname: proc.server,
        };
        const memPort = ns.getPortHandle(MEMORY_PORT);
        await MemoryProtocol.sendMessage(memPort, MessageType.Release, release);
    }
    releaseAtExit(ns) {
        const release = this.release.bind(this, ns);
        ns.atExit(() => {
            void release();
        }, 'memoryRelease-' + makeFuid(ns));
        ns.print(`INFO: registered atExit release for allocation ${this.allocationId}`);
    }
    totalAllocatedRam() {
        return this.allocatedChunks.reduce((sum, chunk) => sum + chunk.totalSize, 0);
    }
}
export class AllocationChunk {
    hostname;
    chunkSize;
    numChunks;
    constructor(chunk) {
        this.hostname = chunk.hostname;
        this.chunkSize = chunk.chunkSize;
        this.numChunks = chunk.numChunks;
    }
    get totalSize() {
        return this.chunkSize * this.numChunks;
    }
}
