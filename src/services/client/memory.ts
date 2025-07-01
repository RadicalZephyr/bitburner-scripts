import type { NS, NetscriptPort } from "netscript";

export const MEMORY_PORT: number = 200;
export const MEMORY_RESPONSE_PORT: number = 201;

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

export type Message = [
    type: MessageType,
    requestId: string,
    payload: Payload,
];

export type Response = [
    requestId: string,
    response: any,
];

// Compact version for use over ports if needed
export interface AllocationRequest {
    pid: number,
    filename: string,
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
}

export interface StatusRequest {
}

export interface SnapshotRequest {
}

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


export class MemoryClient {
    ns: NS;
    port: NetscriptPort;
    responsePort: NetscriptPort;

    constructor(ns: NS) {
        this.ns = ns;
        this.port = ns.getPortHandle(MEMORY_PORT);
        this.responsePort = ns.getPortHandle(MEMORY_RESPONSE_PORT);
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
        let payload = {
            pid: pid,
            filename: this.ns.self().filename,
            chunkSize: chunkSize,
            numChunks: numChunks,
            contiguous: contiguous,
            coreDependent: coreDependent,
        } as AllocationRequest;
        let result = await this.sendMessage(MessageType.Request, payload);
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
        this.ns.print(
            `INFO: releasing ${numChunks} chunks from allocation ${allocationId}`
        );

        const payload: AllocationChunksRelease = {
            allocationId,
            numChunks,
        };
        const result = await this.sendMessage(MessageType.ReleaseChunks, payload);
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
        const result = await this.sendMessage(MessageType.Snapshot, payload);
        if (!result) {
            this.ns.print("WARN: snapshot request failed");
            return null;
        }
        return result as MemorySnapshot;
    }

    async getFreeRam(): Promise<number> {
        const payload: StatusRequest = {};
        const result = await this.sendMessage(MessageType.Status, payload);
        if (!result) {
            this.ns.print("WARN: status request failed");
            return 0;
        }
        const status = result as { freeRam: number };
        return status.freeRam;
    }

    private async sendMessage(type: MessageType, payload: Payload) {
        return await sendMessage(this.ns, this.port, this.responsePort, type, payload)
    }
}

/** Generate a simple unique ID: pid‐timestamp‐rand **/
function makeReqId(ns: NS) {
    const pid = ns.pid;
    const ts = Date.now();
    const r = Math.floor(Math.random() * 1e6);
    return `${pid}-${ts}-${r}`;
}

async function sendMessage(ns: NS, port: NetscriptPort, responsePort: NetscriptPort, type: MessageType, payload: Payload) {
    const requestId = makeReqId(ns);

    let message = [type, requestId, payload];
    while (!port.tryWrite(message)) {
        await ns.sleep(200);
    }

    while (true) {
        await responsePort.nextWrite();
        let nextMessage = responsePort.peek() as Response;
        if (nextMessage[0] === requestId) {
            // N.B. Important to pop our message from the port so
            // other messages can be processed!
            responsePort.read();
            return nextMessage[1];
        }
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
        sendMessage(ns, memPort, memResponsePort, MessageType.Release, release);
    }, "memoryRelease" + name);

    let memPort = ns.getPortHandle(MEMORY_PORT);
    let memResponsePort = ns.getPortHandle(MEMORY_RESPONSE_PORT);

    await sendMessage(ns, memPort, memResponsePort, MessageType.Claim, claim);
}

export class TransferableAllocation {
    allocationId: number;
    allocatedChunks: AllocationChunk[];

    constructor(allocationId: number, allocations: HostAllocation[]) {
        this.allocationId = allocationId;
        this.allocatedChunks = allocations.map(chunk => new AllocationChunk(chunk));
    }

    async release(ns: NS) {
        const proc = ns.self();
        const release: AllocationRelease = {
            allocationId: this.allocationId,
            pid: proc.pid,
            hostname: proc.server,
        };

        let memPort = ns.getPortHandle(MEMORY_PORT);
        let memResponsePort = ns.getPortHandle(MEMORY_RESPONSE_PORT);
        sendMessage(ns, memPort, memResponsePort, MessageType.Release, release);
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
