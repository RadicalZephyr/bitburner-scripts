import { HostAllocation } from 'services/client/memory';

import { formatRam } from 'util/format';

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

export interface FreeChunk {
    hostname: string;
    freeRam: number;
}

export class MemoryAllocator {
    workers: Worker[] = [];

    constructor() {}

    pushWorker(worker: Worker) {
        this.workers.push(worker);
    }

    /**
     * Query total free RAM across all workers.
     *
     * @returns Total free RAM across all workers in GB
     */
    getFreeRamTotal(): number {
        return this.workers.reduce((sum, w) => sum + w.freeRam, 0);
    }

    /**
     * Get a list of available free RAM chunks on each worker.
     *
     * @returns Array describing free RAM per worker
     */
    getFreeChunks(): FreeChunk[] {
        return this.workers.map((w) => {
            return { hostname: w.hostname, freeRam: w.freeRam };
        });
    }
}

export class Worker {
    private _hostname: string = '';
    private _totalRam: bigint = 0n;
    private _setAsideRam: bigint = 0n;
    private _allocatedRam: bigint = 0n;

    constructor(hostname: string, totalRam: number, setAsideRam?: number) {
        this._hostname = hostname;
        this._totalRam = toFixed(totalRam);
        this._setAsideRam = setAsideRam ? toFixed(setAsideRam) : 0n;
    }

    get hostname(): string {
        return this._hostname;
    }

    get usedRam(): number {
        return fromFixed(this._allocatedRam);
    }

    get freeRam(): number {
        return fromFixed(
            this._totalRam - this._allocatedRam - this._setAsideRam,
        );
    }

    updateTotalRam(ram: number) {
        this._totalRam = toFixed(ram);
    }

    updateSetAsideRam(ram: number) {
        this._setAsideRam = toFixed(ram);
    }

    /**
     * Attempt to allocate some memory on this Worker.
     *
     * @param chunkSize - Size in GB of the chunks to allocate
     * @param numChunks - Number of chunks to allocate
     * @returns Description of the allocation on this Worker or null if allocation failed
     */
    allocate(chunkSize: number, numChunks: number): HostAllocation | null {
        const totalAllocRam = toFixed(chunkSize) * BigInt(numChunks);
        if (
            this._totalRam
            < totalAllocRam + this._allocatedRam + this._setAsideRam
        )
            return null;

        this._allocatedRam += totalAllocRam;
        return {
            hostname: this._hostname,
            chunkSize,
            numChunks,
        };
    }

    /**
     * Free some memory on this worker.
     *
     * @param chunkSize - Size in GB of the chunks to allocate
     * @param numChunks - Number of chunks to allocate
     */
    free(chunkSize: number, numChunks: number): void {
        const totalAllocRam = toFixed(chunkSize) * BigInt(numChunks);
        if (this._allocatedRam < totalAllocRam)
            throw new Error(
                `attempted to free ${numChunks}x${formatRam(chunkSize)}, `
                    + `only ${formatRam(fromFixed(this._allocatedRam))} allocated`,
            );
        this._allocatedRam -= totalAllocRam;
    }
}
