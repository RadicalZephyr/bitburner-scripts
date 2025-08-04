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

    constructor() { }

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
    private _hostname: string;
    private totalRam: bigint;

    constructor(hostname: string, totalRam: number) {
        this._hostname = hostname;
        this.totalRam = toFixed(totalRam);
    }

    get hostname(): string {
        return this._hostname;
    }

    get freeRam(): number {
        return fromFixed(this.totalRam);
    }
}
