import type { NS, ProcessInfo } from 'netscript';

import {
    HostAllocation,
    AllocationResult,
    MemorySnapshot,
    WorkerSnapshot,
    AllocationSnapshot,
    AllocationClaim,
    AllocationRegister,
} from 'services/client/memory';
import { ALLOC_ID_ARG } from 'services/client/memory_tag';

/**
 * Convert a floating point RAM value to a fixed point bigint
 * representation.
 *
 * @param val - The value to convert.
 * @returns The bigint representation.
 */
export const toFixed = (val: number): bigint => BigInt(Math.round(val * 100));

/**
 * Convert a fixed point bigint representation back into a number.
 *
 * @param val - The bigint value.
 * @returns The numeric RAM value.
 */
export const fromFixed = (val: bigint): number => Number(val) / 100;

export interface ClaimInfo {
    pid: number;
    hostname: string;
    filename: string;
    chunkSize: number;
    numChunks: number;
}

function hasAllocTag(proc: ProcessInfo): boolean {
    const idx = proc.args.indexOf(ALLOC_ID_ARG);
    return idx !== -1 && typeof proc.args[idx + 1] === 'number';
}

export type LogFn = (line: string) => void;

export interface FreeChunk {
    hostname: string;
    freeRam: number;
}

export class MemoryAllocator {
    ns: NS;
    printLog: LogFn;

    nextAllocId: number = 0;
    workers: Map<string, Worker> = new Map();
    allocations: Map<number, Allocation> = new Map();

    constructor(ns: NS, printLog?: LogFn) {
        this.ns = ns;
        this.printLog = printLog ?? (() => null);
    }

    /**
     * Add a new worker to allocate memory on.
     *
     * @param hostname    - Host name of new worker
     * @param setAsideRam - Amount of RAM to reserve for player use
     */
    pushWorker(hostname: string, setAsideRam?: number) {
        if (this.workers.has(hostname)) {
            this.printLog(
                `INFO: received duplicate worker registration for ${hostname}`,
            );
            return;
        }

        if (
            hostname.startsWith('pserv')
            && setAsideRam === undefined
            && this.ns.getServerMaxRam(hostname) > 1024
        ) {
            setAsideRam = 8;
        }

        if (
            hostname.startsWith('hacknet-server')
            && setAsideRam === undefined
        ) {
            setAsideRam = this.ns.getServerMaxRam(hostname);
        }

        this.workers.set(hostname, new Worker(this.ns, hostname, setAsideRam));
        this.printLog(
            `INFO: registered worker ${hostname} with `
                + `${this.ns.formatRam(this.ns.getServerMaxRam(hostname))}`,
        );
    }

    /** Check if the home server has increased in RAM. */
    checkHomeForRamIncrease() {
        if (this.workers.has('home')) {
            const home = this.workers.get('home');
            home.updateRam();
        }
    }

    /**
     * Get a list of available free RAM chunks on each worker.
     *
     * @returns Array describing free RAM per worker
     */
    getFreeChunks(): FreeChunk[] {
        const chunks: FreeChunk[] = [];
        for (const w of this.workers.values()) {
            if (w.freeRam > 0) {
                chunks.push({ hostname: w.hostname, freeRam: w.freeRam });
            }
        }
        return chunks;
    }

    /**
     * Query total free RAM across all workers.
     * @returns Total free RAM across all workers in GB
     */
    getFreeRamTotal(): number {
        return this.getFreeChunks().reduce((sum, c) => sum + c.freeRam, 0);
    }

    /** Check for allocations belonging to terminated processes. */
    cleanupTerminated(): void {
        for (const [id, allocation] of this.allocations.entries()) {
            if (
                allocation.claims.length === 0
                && !this.ns.isRunning(allocation.pid)
            ) {
                for (const c of allocation.chunks) {
                    const worker = this.workers.get(c.hostname);
                    if (worker) {
                        worker.free(c.chunkSize * c.numChunks);
                    }
                }

                this.allocations.delete(id);
            }

            const remaining: ClaimInfo[] = [];
            for (const claim of allocation.claims) {
                if (!this.ns.isRunning(claim.pid)) {
                    // Release the memory held by this terminated pid
                    this.releaseClaimInternal(allocation, claim);
                    this.printLog(
                        `INFO: reclaimed allocation ${id} `
                            + `pid=${claim.pid} host=${claim.hostname}`,
                    );
                } else {
                    remaining.push(claim);
                }
            }

            allocation.claims = remaining;
            allocation.chunks = allocation.chunks.filter(
                (c) => c.numChunks > 0,
            );
            if (allocation.chunks.length === 0) {
                this.allocations.delete(id);
            }
        }
    }

    /**
     * Refresh the reserved RAM on each worker host.
     */
    updateReserved(): void {
        for (const worker of this.workers.values()) {
            worker.updateTotalRam();
            const procs = this.ns.ps(worker.hostname);
            let allocRam = 0n;
            let foreignRam = 0n;
            for (const p of procs) {
                const ram = toFixed(
                    this.ns.getScriptRam(p.filename, worker.hostname),
                );
                if (hasAllocTag(p)) allocRam += ram;
                else if (this.isRegistered(p.pid)) allocRam += ram;
                else foreignRam += ram;
            }
            if (allocRam > worker.allocatedRam) {
                const allocRamStr = this.ns.formatRam(fromFixed(allocRam));
                const workerAllocRamStr = this.ns.formatRam(
                    fromFixed(worker.allocatedRam),
                );
                this.printLog(
                    `WARN: ${worker.hostname} has more in use RAM `
                        + `attributed to allocations (${allocRamStr}) `
                        + `than total allocated RAM (${workerAllocRamStr})`,
                );
            }

            worker.reservedRam = foreignRam;
        }
    }

    /**
     * Copy a snapshot of the current internal state. Primarily for
     * use by the leak checker utility.
     *
     * @returns Full snapshot of current memory allocation state
     */
    getSnapshot(): MemorySnapshot {
        const workers: WorkerSnapshot[] = [];
        for (const w of this.workers.values()) {
            workers.push({
                hostname: w.hostname,
                totalRam: w.totalRam,
                setAsideRam: fromFixed(w.setAsideRam),
                reservedRam: fromFixed(w.reservedRam),
                allocatedRam: fromFixed(w.allocatedRam),
            });
        }

        const allocations: AllocationSnapshot[] = [];
        for (const [id, alloc] of this.allocations.entries()) {
            allocations.push({
                allocationId: id,
                pid: alloc.pid,
                filename: alloc.filename,
                hosts: alloc.chunks.map((c) => c.asHostAllocation()),
                claims: alloc.claims.map((c) => ({
                    pid: c.pid,
                    hostname: c.hostname,
                    filename: c.filename,
                    chunkSize: c.chunkSize,
                    numChunks: c.numChunks,
                })),
            });
        }

        return { workers, allocations };
    }

    /**
     * Allocate RAM for the given pid.
     *
     * When `coreDependent` is true the home server is preferred for
     * the allocation. Otherwise the manager will try to allocate on
     * non-home servers first. When `longRunning` is true the allocator
     * avoids using the home server and prioritizes non-purchased hosts
     * before purchased servers.
     */
    allocate(
        pid: number,
        filename: string,
        chunkSize: number,
        numChunks: number,
        contiguous: boolean = false,
        coreDependent: boolean = false,
        shrinkable: boolean = false,
        longRunning: boolean = false,
        notifyPort?: number,
    ): AllocationResult {
        if (chunkSize <= 0 || numChunks <= 0) {
            this.printLog('ERROR: bad allocation request, zero size');
            return null;
        }

        const workers = Array.from(this.workers.values());

        const purchased = new Set(this.ns.getPurchasedServers());

        workers.sort((a, b) => {
            if (longRunning) {
                const prio = (w: { hostname: string }) =>
                    w.hostname === 'home'
                        ? 2
                        : purchased.has(w.hostname)
                          ? 1
                          : 0;
                const pa = prio(a);
                const pb = prio(b);
                if (pa !== pb) return pa - pb;
                return b.freeRam - a.freeRam;
            }

            if (a.hostname === 'home' && b.hostname !== 'home') {
                return coreDependent ? -1 : 1;
            }
            if (a.hostname !== 'home' && b.hostname === 'home') {
                return coreDependent ? 1 : -1;
            }
            return b.freeRam - a.freeRam;
        });

        if (contiguous) {
            // If any worker can satisfy the full request, allocate it there.
            for (const worker of workers) {
                if (Math.floor(worker.freeRam / chunkSize) >= numChunks) {
                    const chunk = worker.allocate(chunkSize, numChunks);
                    const id = this.nextAllocId++;
                    const allocation = new Allocation(
                        id,
                        pid,
                        filename,
                        [chunk],
                        numChunks,
                        notifyPort,
                    );
                    this.allocations.set(id, allocation);
                    return allocation.asAllocationResult();
                }
            }
        }

        const chunks: AllocationChunk[] = [];
        let remainingChunks = numChunks;

        for (const worker of workers) {
            const chunk = worker.allocate(chunkSize, remainingChunks);
            if (chunk) {
                chunks.push(chunk);
                remainingChunks -= chunk.numChunks;
            }

            if (remainingChunks <= 0) break;
        }

        if (chunks.length == 0 || (!shrinkable && remainingChunks > 0)) {
            // Roll back partial allocations
            for (const chunk of chunks) {
                this.workers.get(chunk.hostname)?.free(chunk.totalSize);
            }
            return null; // Allocation failed
        }

        const id = this.nextAllocId++;
        const allocation = new Allocation(
            id,
            pid,
            filename,
            chunks,
            numChunks,
            notifyPort,
        );
        this.allocations.set(id, allocation);

        return allocation.asAllocationResult();
    }

    /**
     * Register an artificial allocation for a process that wasn't
     * allocated before starting.
     *
     * @param info - Details of the allocation to register
     * @returns AllocationResult
     */
    registerAllocation(info: AllocationRegister): AllocationResult {
        const worker = this.workers.get(info.hostname);
        if (!worker) return null;

        const chunk = new AllocationChunk(
            info.hostname,
            info.chunkSize,
            info.numChunks,
        );
        const id = this.nextAllocId++;
        const allocation = new Allocation(
            id,
            info.pid,
            info.filename,
            [chunk],
            info.numChunks,
        );
        this.allocations.set(id, allocation);

        worker.allocatedRam += toFixed(info.chunkSize * info.numChunks);
        worker.updateReservedRam();

        return allocation.asAllocationResult();
    }

    /**
     * Free an allocation.
     *
     * @param id       - Allocation ID
     * @param pid      - PID of process initiating deallocation
     * @param hostname - Hostname where process initiating deallocation is running
     * @returns Indicates whether deallocation succeeded
     */
    deallocate(id: number, pid: number, hostname: string): boolean {
        const allocation = this.allocations.get(id);
        if (!allocation) return false;

        // Released by single requesting process, release all chunks
        if (allocation.pid === pid) {
            for (const c of allocation.chunks) {
                const worker = this.workers.get(c.hostname);
                if (worker) {
                    worker.free(c.chunkSize * c.numChunks);
                }
            }
            this.allocations.delete(id);
            return true;
        }

        return this.releaseClaim(id, pid, hostname);
    }

    /**
     * Release a claim on an allocation.
     *
     * @param id       - Allocation ID
     * @param pid      - PID of process initiating deallocation
     * @param hostname - Hostname where process initiating deallocation is running
     * @returns Indicates whether claim release succeeded
     */
    releaseClaim(id: number, pid: number, hostname: string): boolean {
        const allocation = this.allocations.get(id);
        if (!allocation) return false;

        const idx = allocation.claims.findIndex(
            (c) => c.pid === pid && c.hostname === hostname,
        );
        if (idx === -1) {
            this.printLog(
                `WARN: couldn't find a claim for ${pid} on ${hostname} to release`,
            );
            return false;
        }
        const claim = allocation.claims[idx];
        this.releaseClaimInternal(allocation, claim);
        allocation.claims.splice(idx, 1);
        allocation.chunks = allocation.chunks.filter((c) => c.numChunks > 0);
        if (allocation.chunks.length === 0) {
            this.allocations.delete(id);
        }
        return true;
    }

    /**
     * Release a number of chunks from an allocation.
     *
     * @param id        - Allocation ID
     * @param numChunks - The number of chunks to release
     * @returns The new allocation details after releasing the chunks
     */
    releaseChunks(id: number, numChunks: number): AllocationResult | null {
        const allocation = this.allocations.get(id);
        if (!allocation) return null;

        let remaining = numChunks;
        const chunks = [...allocation.chunks].sort((a, b) => {
            const freeA = this.workers.get(a.hostname)?.freeRam ?? 0;
            const freeB = this.workers.get(b.hostname)?.freeRam ?? 0;
            return freeB - freeA;
        });

        for (const chunk of chunks) {
            if (remaining <= 0) break;
            const toFree = Math.min(remaining, chunk.numChunks);
            const worker = this.workers.get(chunk.hostname);
            if (worker) {
                worker.free(chunk.chunkSize * toFree);
            }
            chunk.numChunks -= toFree;
            remaining -= toFree;

            let remainingFromClaims = toFree;
            for (const claim of allocation.claims) {
                if (remainingFromClaims <= 0) break;
                if (
                    claim.hostname === chunk.hostname
                    && claim.chunkSize === chunk.chunkSize
                ) {
                    const reduce = Math.min(
                        claim.numChunks,
                        remainingFromClaims,
                    );
                    claim.numChunks -= reduce;
                    remainingFromClaims -= reduce;
                }
            }
        }

        // Important! Reduce the number of requested chunks so the
        // allocator doesn't try to grow our allocation back to the
        // original size!!
        allocation.requestedChunks = Math.max(
            0,
            allocation.requestedChunks - numChunks,
        );
        allocation.chunks = allocation.chunks.filter((c) => c.numChunks > 0);
        allocation.claims = allocation.claims.filter((c) => c.numChunks > 0);
        if (allocation.chunks.length === 0) {
            this.allocations.delete(id);
            return null;
        }

        return allocation.asAllocationResult();
    }

    /**
     * Attempt to add additional chunks to an existing allocation.
     *
     * @param allocation - Allocation to grow
     * @param numChunks  - Desired number of additional chunks
     * @returns           Details about the newly allocated chunks
     */
    growAllocation(
        allocation: Allocation,
        numChunks: number,
    ): HostAllocation[] {
        const chunkSize = allocation.chunks[0]?.chunkSize;
        if (!chunkSize || numChunks <= 0) return [];

        let remaining = numChunks;
        const workers = Array.from(this.workers.values()).sort(
            (a, b) => b.freeRam - a.freeRam,
        );
        const chunks: AllocationChunk[] = [];

        for (const worker of workers) {
            if (remaining <= 0) break;
            const chunk = worker.allocate(chunkSize, remaining);
            if (chunk) {
                chunks.push(chunk);
                remaining -= chunk.numChunks;
            }
        }

        if (chunks.length > 0) {
            allocation.chunks.push(...chunks);
        }
        return chunks.map((c) => c.asHostAllocation());
    }

    claimAllocation(claim: AllocationClaim): boolean {
        const allocation = this.allocations.get(claim.allocationId);
        if (!allocation) return false;

        const chunk = allocation.chunks.find(
            (c) =>
                c.hostname === claim.hostname
                && c.chunkSize === claim.chunkSize,
        );
        if (!chunk) {
            this.printLog(
                `WARN: claim request for allocation ${claim.allocationId} on ${claim.hostname} not found`,
            );
            return false;
        }

        const claimedSoFar = allocation.claims
            .filter(
                (c) =>
                    c.hostname === claim.hostname
                    && c.chunkSize === claim.chunkSize,
            )
            .reduce((sum, c) => sum + c.numChunks, 0);

        if (claimedSoFar + claim.numChunks > chunk.numChunks) {
            this.printLog(
                `WARN: claim for allocation ${claim.allocationId} exceeds reserved chunks`,
            );
            return false;
        }

        allocation.claims.push(claim as ClaimInfo);

        return true;
    }

    /**
     * Release the RAM associated with a single claim without
     * removing it from the allocation's claim list.
     */
    private releaseClaimInternal(allocation: Allocation, claim: ClaimInfo) {
        const worker = this.workers.get(claim.hostname);
        if (worker) {
            worker.free(claim.chunkSize * claim.numChunks);
        }
        const chunk = allocation.chunks.find(
            (c) =>
                c.hostname === claim.hostname
                && c.chunkSize === claim.chunkSize,
        );
        if (chunk) {
            chunk.numChunks -= claim.numChunks;
        }
    }

    private isRegistered(pid: number): boolean {
        for (const alloc of this.allocations.values()) {
            if (alloc.pid === pid) return true;
            if (alloc.claims.some((c) => c.pid === pid)) return true;
        }
        return false;
    }
}

class Allocation {
    id: number;
    pid: number;
    filename: string;
    chunks: AllocationChunk[];
    claims: ClaimInfo[] = [];
    requestedChunks: number;
    notifyPort?: number;

    constructor(
        id: number,
        pid: number,
        filename: string,
        chunks: AllocationChunk[],
        requestedChunks: number,
        notifyPort?: number,
    ) {
        this.id = id;
        this.pid = pid;
        this.filename = filename;
        this.chunks = chunks;
        this.requestedChunks = requestedChunks;
        this.notifyPort = notifyPort;
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

export class Worker {
    ns: NS;
    hostname: string;
    totalRam: number;
    totalRamStr: string;
    setAsideRam: bigint;
    reservedRam: bigint;
    allocatedRam: bigint = 0n;

    constructor(ns: NS, hostname: string, setAsideRam?: number) {
        this.ns = ns;
        this.hostname = hostname;
        this.updateTotalRam();
        this.setAsideRam =
            typeof setAsideRam == 'number' && setAsideRam >= 0
                ? toFixed(setAsideRam)
                : 0n;
        this.reservedRam = toFixed(ns.getServerUsedRam(hostname));
    }

    get usedRam(): number {
        return fromFixed(
            this.setAsideRam + this.reservedRam + this.allocatedRam,
        );
    }

    get freeRam(): number {
        return Math.max(0, this.totalRam - this.usedRam);
    }

    updateTotalRam() {
        this.totalRam = this.ns.getServerMaxRam(this.hostname);
        this.totalRamStr = this.ns.formatRam(this.totalRam, 0);
        if (this.hostname === 'home' && this.totalRam > 32) {
            this.setAsideRam = toFixed(32);
        }
    }

    updateReservedRam() {
        const actual = toFixed(this.ns.getServerUsedRam(this.hostname));
        const diff = actual - this.allocatedRam;
        this.reservedRam = diff > 0n ? diff : 0n;
    }

    /**
     * Attempt to allocate some memory on this Worker.
     *
     * @param chunkSize - Size in GB of the chunks to allocate
     * @param numChunks - Number of chunks to allocate
     * @returns Description of the allocation on this Worker or null if allocation failed
     */
    allocate(chunkSize: number, numChunks: number): AllocationChunk {
        const maxAllocatableChunks = Math.floor(this.freeRam / chunkSize);
        const chunksToAllocate = Math.min(numChunks, maxAllocatableChunks);

        if (chunksToAllocate <= 0) return null;

        const ram = chunkSize * chunksToAllocate;
        this.allocatedRam += toFixed(ram);

        return new AllocationChunk(this.hostname, chunkSize, chunksToAllocate);
    }

    /**
     * Free some memory on this worker.
     *
     * @param ram - Total RAM to free on this worker
     */
    free(ram: number): void {
        const delta = toFixed(ram);
        this.allocatedRam =
            this.allocatedRam >= delta ? this.allocatedRam - delta : 0n;
    }

    /** Update server's total RAM. */
    updateRam() {
        this.totalRam = this.ns.getServerMaxRam(this.hostname);
        this.totalRamStr = this.ns.formatRam(this.totalRam, 0);
    }
}
