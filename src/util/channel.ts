type Defer<T> = {
    promise: Promise<T>;
    resolve: (v: T) => void;
    reject: (e: unknown) => void;
};

function defer<T>(): Defer<T> {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

export type ReadOptions = { signal?: AbortSignal; timeoutMs?: number };
export type WriteOptions = { signal?: AbortSignal; timeoutMs?: number };

export class Channel<T = unknown> {
    private readonly buf: T[] = [];
    private readonly readers: Array<(v: T) => void> = [];
    private readonly writers: Array<{
        value: T;
        resolve: () => void;
        reject: (e: unknown) => void;
        signal?: AbortSignal;
    }> = [];
    private _closed = false;

    constructor(public readonly capacity: number = 100) {
        if (capacity <= 0 || !Number.isFinite(capacity))
            throw new Error(`Invalid capacity: ${capacity}`);
    }

    get closed() {
        return this._closed;
    }
    size() {
        return this.buf.length;
    }
    empty() {
        return this.buf.length === 0;
    }
    full() {
        return this.buf.length >= this.capacity;
    }

    clear() {
        this.buf.length = 0;
        // Do not disturb waiters; this is a data-only flush.
    }

    close(err?: any) {
        if (this._closed) return;
        this._closed = true;
        // Fail all pending writers/readers.
        const e = err ?? new Error('Channel closed');
        for (const w of this.writers.splice(0)) w.reject(e);
        for (const r of this.readers.splice(0)) {
            /* wake readers with error via microtask */ Promise.resolve().then(
                () => {
                    throw e;
                },
            );
        }
    }

    async readAsync(opts: ReadOptions = {}): Promise<T> {
        if (this._closed && this.empty()) throw new Error('Channel closed');
        // Fast path: buffered item
        if (this.buf.length > 0) {
            const v = this.buf.shift() as T;
            // If writers are queued (blocked due to full earlier), promote one into the buffer
            if (this.writers.length > 0) {
                const w = this.writers.shift()!;
                this.buf.push(w.value);
                w.resolve();
            }
            return v;
        }
        // If a writer is already waiting, handoff directly (zero buffering)
        if (this.writers.length > 0) {
            const w = this.writers.shift()!;
            w.resolve();
            return w.value;
        }

        const d = defer<T>();
        let timeout: any;
        const cleanup = () => {
            if (timeout) clearTimeout(timeout);
            if (opts.signal) opts.signal.removeEventListener('abort', onAbort);
            // Remove from readers if still present (rare race)
            const i = this.readers.indexOf(d.resolve);
            if (i >= 0) this.readers.splice(i, 1);
        };
        const onAbort = () => {
            cleanup();
            d.reject(new DOMException('Aborted', 'AbortError'));
        };

        if (opts.signal)
            opts.signal.addEventListener('abort', onAbort, { once: true });
        if (opts.timeoutMs != null)
            timeout = setTimeout(() => {
                cleanup();
                d.reject(new Error('Timeout'));
            }, opts.timeoutMs);

        // Queue this reader; the first write that arrives will resolve us.
        this.readers.push((v: T) => {
            cleanup();
            d.resolve(v);
        });

        // If channel closed after we queued
        if (this._closed) {
            // Try to dequeue ourselves and error
            cleanup();
            throw new Error('Channel closed');
        }
        return d.promise;
    }

    async writeAsync(value: T, opts: WriteOptions = {}): Promise<void> {
        if (this._closed) throw new Error('Channel closed');

        // If a reader is waiting, complete it immediately (no buffering, lowest latency)
        if (this.readers.length > 0) {
            const r = this.readers.shift()!;
            r(value);
            return;
        }
        // If buffer has room, enqueue
        if (this.buf.length < this.capacity) {
            this.buf.push(value);
            return;
        }
        // Otherwise, block (backpressure): queue this writer until space frees
        const d = defer<void>();
        let timeout: any;
        const onAbort = () => {
            cleanup();
            d.reject(new DOMException('Aborted', 'AbortError'));
        };
        const cleanup = () => {
            if (timeout) clearTimeout(timeout);
            if (opts.signal) opts.signal.removeEventListener('abort', onAbort);
            // Remove from writers if still present
            const i = this.writers.indexOf(entry);
            if (i >= 0) this.writers.splice(i, 1);
        };
        const entry = {
            value,
            resolve: () => {
                cleanup();
                d.resolve();
            },
            reject: (e: any) => {
                cleanup();
                d.reject(e);
            },
            signal: opts.signal,
        };

        if (opts.signal)
            opts.signal.addEventListener('abort', onAbort, { once: true });
        if (opts.timeoutMs != null)
            timeout = setTimeout(() => {
                cleanup();
                d.reject(new Error('Timeout'));
            }, opts.timeoutMs);

        this.writers.push(entry);

        // If channel closed after we queued
        if (this._closed) {
            cleanup();
            throw new Error('Channel closed');
        }
        return d.promise;
    }

    // Nice sugar for consumers: for await (const item of chan) { ... }
    async *[Symbol.asyncIterator](): AsyncIterator<T> {
        while (true) yield await this.readAsync();
    }
}

const ports = new Map<number, Channel>();

function assertIndex(i: number): void {
    if (!Number.isInteger(i) || i < 0) {
        throw new RangeError(`Port index out of range: ${i} (valid: 0..∞)`);
    }
}

function getOrCreate(i: number): Channel {
    assertIndex(i);
    let p = ports.get(i);
    if (!p) {
        p = new Channel(100);
        ports.set(i, p);
    }
    return p;
}

/**
 * Get a handle to MPMC channel queue.
 *
 * @param i - channel index to get a handle to
 * @returns Channel
 */
export function getChannel(i: number): Channel {
    return getOrCreate(i);
}
