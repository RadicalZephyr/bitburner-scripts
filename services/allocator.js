/**
 * Convert a floating point RAM value to a fixed point bigint
 * representation.
 *
 * @param val - The value to convert.
 * @returns The bigint representation.
 */
export const toFixed = (val) => BigInt(Math.round(val * 100));
/**
 * Convert a fixed point bigint representation back into a number.
 *
 * @param val - The bigint value.
 * @returns The numeric RAM value.
 */
export const fromFixed = (val) => Number(val) / 100;
export class MemoryAllocator {
    ns;
    printLog;
    nextAllocId = 0;
    workers = new Map();
    allocations = new Map();
    constructor(ns, printLog) {
        this.ns = ns;
        this.printLog = printLog ?? (() => null);
    }
    pushWorker(hostname, setAsideRam) {
        if (this.workers.has(hostname)) {
            this.printLog(`INFO: received duplicate worker registration for ${hostname}`);
            return;
        }
        this.workers.set(hostname, new Worker(this.ns, hostname, setAsideRam));
        this.printLog(`INFO: registered worker ${hostname} with ` +
            `${this.ns.formatRam(this.ns.getServerMaxRam(hostname))}`);
    }
    getFreeRamTotal() {
        let total = 0;
        for (const w of this.workers.values()) {
            total += w.freeRam;
        }
        return total;
    }
    cleanupTerminated() {
        for (const [id, allocation] of this.allocations.entries()) {
            if (allocation.claims.length === 0 && !this.ns.isRunning(allocation.pid)) {
                for (const c of allocation.chunks) {
                    let worker = this.workers.get(c.hostname);
                    if (worker) {
                        worker.free(c.chunkSize * c.numChunks);
                    }
                }
                this.allocations.delete(id);
            }
            const remaining = [];
            for (const claim of allocation.claims) {
                if (!this.ns.isRunning(claim.pid)) {
                    // Release the memory held by this terminated pid
                    this.releaseClaimInternal(allocation, claim);
                    this.printLog(`INFO: reclaimed allocation ${id} ` +
                        `pid=${claim.pid} host=${claim.hostname}`);
                }
                else {
                    remaining.push(claim);
                }
            }
            allocation.claims = remaining;
            allocation.chunks = allocation.chunks.filter(c => c.numChunks > 0);
            if (allocation.chunks.length === 0) {
                this.allocations.delete(id);
            }
        }
    }
    /**
     * Refresh the reserved RAM on each worker host.
     */
    updateReserved() {
        for (const worker of this.workers.values()) {
            const actual = toFixed(this.ns.getServerUsedRam(worker.hostname));
            const diff = actual - worker.allocatedRam;
            worker.reservedRam = diff > 0n ? diff : 0n;
        }
    }
    getSnapshot() {
        const workers = [];
        for (const w of this.workers.values()) {
            workers.push({
                hostname: w.hostname,
                totalRam: w.totalRam,
                setAsideRam: fromFixed(w.setAsideRam),
                reservedRam: fromFixed(w.reservedRam),
                allocatedRam: fromFixed(w.allocatedRam),
            });
        }
        const allocations = [];
        for (const [id, alloc] of this.allocations.entries()) {
            allocations.push({
                allocationId: id,
                pid: alloc.pid,
                filename: alloc.filename,
                hosts: alloc.chunks.map(c => c.asHostAllocation()),
                claims: alloc.claims.map(c => ({
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
     * non-home servers first.
     */
    allocate(pid, filename, chunkSize, numChunks, contiguous = false, coreDependent = false, shrinkable = false) {
        if (chunkSize <= 0 || numChunks <= 0) {
            this.printLog("ERROR: bad allocation request, zero size");
            return null;
        }
        let workers = Array.from(this.workers.values());
        workers.sort((a, b) => {
            if (a.hostname === "home" && b.hostname !== "home") {
                return coreDependent ? -1 : 1;
            }
            if (a.hostname !== "home" && b.hostname === "home") {
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
                    const allocation = new Allocation(id, pid, filename, [chunk]);
                    this.allocations.set(id, allocation);
                    return allocation.asAllocationResult();
                }
            }
        }
        let chunks = [];
        let remainingChunks = numChunks;
        for (const worker of workers) {
            const chunk = worker.allocate(chunkSize, remainingChunks);
            if (chunk) {
                chunks.push(chunk);
                remainingChunks -= chunk.numChunks;
            }
            if (remainingChunks <= 0)
                break;
        }
        if (chunks.length == 0 || (!shrinkable && remainingChunks > 0)) {
            // Roll back partial allocations
            for (const chunk of chunks) {
                this.workers.get(chunk.hostname)?.free(chunk.totalSize);
            }
            return null; // Allocation failed
        }
        const id = this.nextAllocId++;
        const allocation = new Allocation(id, pid, filename, chunks);
        this.allocations.set(id, allocation);
        return allocation.asAllocationResult();
    }
    deallocate(id, pid, hostname) {
        const allocation = this.allocations.get(id);
        if (!allocation)
            return false;
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
    releaseClaim(id, pid, hostname) {
        const allocation = this.allocations.get(id);
        if (!allocation)
            return false;
        const idx = allocation.claims.findIndex(c => c.pid === pid && c.hostname === hostname);
        if (idx === -1) {
            this.printLog(`WARN: couldn't find a claim for ${pid} on ${hostname} to release`);
            return false;
        }
        const claim = allocation.claims[idx];
        this.releaseClaimInternal(allocation, claim);
        allocation.claims.splice(idx, 1);
        allocation.chunks = allocation.chunks.filter(c => c.numChunks > 0);
        if (allocation.chunks.length === 0) {
            this.allocations.delete(id);
        }
        return true;
    }
    releaseChunks(id, numChunks) {
        const allocation = this.allocations.get(id);
        if (!allocation)
            return null;
        let remaining = numChunks;
        const chunks = [...allocation.chunks].sort((a, b) => {
            const freeA = this.workers.get(a.hostname)?.freeRam ?? 0;
            const freeB = this.workers.get(b.hostname)?.freeRam ?? 0;
            return freeB - freeA;
        });
        for (const chunk of chunks) {
            if (remaining <= 0)
                break;
            const toFree = Math.min(remaining, chunk.numChunks);
            const worker = this.workers.get(chunk.hostname);
            if (worker) {
                worker.free(chunk.chunkSize * toFree);
            }
            chunk.numChunks -= toFree;
            remaining -= toFree;
            let remainingFromClaims = toFree;
            for (const claim of allocation.claims) {
                if (remainingFromClaims <= 0)
                    break;
                if (claim.hostname === chunk.hostname && claim.chunkSize === chunk.chunkSize) {
                    const reduce = Math.min(claim.numChunks, remainingFromClaims);
                    claim.numChunks -= reduce;
                    remainingFromClaims -= reduce;
                }
            }
        }
        allocation.chunks = allocation.chunks.filter(c => c.numChunks > 0);
        allocation.claims = allocation.claims.filter(c => c.numChunks > 0);
        if (allocation.chunks.length === 0) {
            this.allocations.delete(id);
            return null;
        }
        return allocation.asAllocationResult();
    }
    claimAllocation(claim) {
        const allocation = this.allocations.get(claim.allocationId);
        if (!allocation)
            return false;
        const chunk = allocation.chunks.find(c => c.hostname === claim.hostname && c.chunkSize === claim.chunkSize);
        if (!chunk) {
            this.printLog(`WARN: claim request for allocation ${claim.allocationId} on ${claim.hostname} not found`);
            return false;
        }
        const claimedSoFar = allocation.claims
            .filter(c => c.hostname === claim.hostname && c.chunkSize === claim.chunkSize)
            .reduce((sum, c) => sum + c.numChunks, 0);
        if (claimedSoFar + claim.numChunks > chunk.numChunks) {
            this.printLog(`WARN: claim for allocation ${claim.allocationId} exceeds reserved chunks`);
            return false;
        }
        allocation.claims.push(claim);
        return true;
    }
    /**
     * Release the RAM associated with a single claim without
     * removing it from the allocation's claim list.
     */
    releaseClaimInternal(allocation, claim) {
        const worker = this.workers.get(claim.hostname);
        if (worker) {
            worker.free(claim.chunkSize * claim.numChunks);
        }
        const chunk = allocation.chunks.find(c => c.hostname === claim.hostname && c.chunkSize === claim.chunkSize);
        if (chunk) {
            chunk.numChunks -= claim.numChunks;
        }
    }
}
class Allocation {
    id;
    pid;
    filename;
    chunks;
    claims = [];
    constructor(id, pid, filename, chunks) {
        this.id = id;
        this.pid = pid;
        this.filename = filename;
        this.chunks = chunks;
    }
    get totalSize() {
        return this.chunks.reduce((sum, c) => sum + c.totalSize, 0);
    }
    asAllocationResult() {
        return {
            allocationId: this.id,
            hosts: this.chunks.map((chunk) => chunk.asHostAllocation()),
        };
    }
}
class AllocationChunk {
    hostname;
    chunkSize;
    numChunks;
    constructor(hostname, chunkSize, numChunks) {
        this.hostname = hostname;
        this.chunkSize = chunkSize;
        this.numChunks = numChunks;
    }
    get totalSize() {
        return this.chunkSize * this.numChunks;
    }
    asHostAllocation() {
        return {
            hostname: this.hostname,
            chunkSize: this.chunkSize,
            numChunks: this.numChunks,
        };
    }
}
export class Worker {
    ns;
    hostname;
    totalRam;
    totalRamStr;
    setAsideRam;
    reservedRam;
    allocatedRam = 0n;
    constructor(ns, hostname, setAsideRam) {
        this.ns = ns;
        this.hostname = hostname;
        this.totalRam = ns.getServerMaxRam(hostname);
        this.totalRamStr = ns.formatRam(this.totalRam, 0);
        this.setAsideRam = typeof setAsideRam == "number" && setAsideRam >= 0 ? toFixed(setAsideRam) : 0n;
        this.reservedRam = toFixed(ns.getServerUsedRam(hostname));
    }
    get usedRam() {
        return fromFixed(this.setAsideRam + this.reservedRam + this.allocatedRam);
    }
    get freeRam() {
        return Math.max(0, this.totalRam - this.usedRam);
    }
    allocate(chunkSize, numChunks) {
        const maxAllocatableChunks = Math.floor(this.freeRam / chunkSize);
        const chunksToAllocate = Math.min(numChunks, maxAllocatableChunks);
        if (chunksToAllocate <= 0)
            return null;
        const ram = chunkSize * chunksToAllocate;
        this.allocatedRam += toFixed(ram);
        return new AllocationChunk(this.hostname, chunkSize, chunksToAllocate);
    }
    free(ram) {
        const delta = toFixed(ram);
        this.allocatedRam = this.allocatedRam >= delta ? this.allocatedRam - delta : 0n;
    }
}
