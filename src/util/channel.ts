import { RingBuffer } from 'util/ring-buffer';
import { SetQueue } from 'util/set-queue';

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

interface Reader<T> {
    resolve: (v: T) => void;
    reject: (e: unknown) => void;
}

interface Writer<T> {
    value: T;
    resolve: () => void;
    reject: (e: unknown) => void;
}

/**
 * Multi-producer, multi-consumer asynchronous channel.
 *
 * Items are delivered in FIFO order and buffered up to the configured
 * `capacity`. When the buffer is empty, readers block until a writer
 * arrives; when full, writers block until space frees. The `read` and
 * `write` methods accept optional `{ signal, timeoutMs }` options to
 * abort or time out waiting operations.
 *
 * @typeParam T - Item type carried by the channel
 */
export class Channel<T = unknown> {
    private readonly buf: RingBuffer<T>;
    private readonly readers: SetQueue<Reader<T>> = new SetQueue();
    private readonly writers: SetQueue<Writer<T>> = new SetQueue();
    private _closed = false;

    constructor(public readonly capacity: number = 100) {
        if (capacity <= 0 || !Number.isFinite(capacity))
            throw new Error(`Invalid capacity: ${capacity}`);
        this.buf = new RingBuffer(capacity);
    }

    get closed() {
        return this._closed;
    }
    size() {
        return this.buf.size;
    }
    empty() {
        return this.buf.size === 0;
    }
    full() {
        return this.buf.size >= this.capacity;
    }

    clear() {
        this.buf.clear();
        // Do not disturb waiters; this is a data-only flush.
    }

    close(err?: unknown) {
        if (this._closed) return;
        this._closed = true;
        // Fail all pending writers/readers.
        const e = err ?? new Error('Channel closed');

        for (const w of this.writers.drain()) w.reject(e);
        for (const r of this.readers.drain()) r.reject(e);
    }

    async read(opts: ReadOptions = {}): Promise<T> {
        if (this._closed && this.empty()) throw new Error('Channel closed');
        // Fast path: buffered item
        if (this.buf.size > 0) {
            const v = this.buf.shift() as T;
            // If writers are queued (blocked due to full earlier), promote one into the buffer
            if (this.writers.size > 0) {
                const w = this.writers.shift()!;
                this.buf.push(w.value);
                w.resolve();
            }
            return v;
        }
        // If a writer is already waiting, handoff directly (zero buffering)
        if (this.writers.size > 0) {
            const w = this.writers.shift()!;
            w.resolve();
            return w.value;
        }

        // Check if abort signal has been received
        if (opts.signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }
        const d = defer<T>();
        let cleanup = () => {};
        const onAbort = () => {
            cleanup();
            d.reject(new DOMException('Aborted', 'AbortError'));
        };
        const onTimeout = () => {
            cleanup();
            d.reject(new Error('Timeout'));
        };
        const removeHandlers = setupWaiter(onAbort, onTimeout, opts);
        const entry = {
            resolve: (v: T) => {
                cleanup();
                d.resolve(v);
            },
            reject: (e: unknown) => {
                cleanup();
                d.reject(e);
            },
        };
        cleanup = () => {
            removeHandlers();
            // Remove from readers if still present
            this.readers.delete(entry);
        };

        // Queue this reader; the first write that arrives will resolve us.
        this.readers.push(entry);

        // If channel closed after we queued
        if (this._closed) {
            // Try to dequeue ourselves and error
            cleanup();
            throw new Error('Channel closed');
        }
        return d.promise;
    }

    async write(value: T, opts: WriteOptions = {}): Promise<void> {
        if (this._closed) throw new Error('Channel closed');

        // If a reader is waiting, complete it immediately (no buffering, lowest latency)
        if (this.readers.size > 0) {
            const r = this.readers.shift()!;
            r.resolve(value);
            return;
        }
        // If buffer has room, enqueue
        if (this.buf.size < this.capacity) {
            this.buf.push(value);
            return;
        }

        // Check if abort signal has been received
        if (opts.signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }
        // Otherwise, block (backpressure): queue this writer until space frees
        const d = defer<void>();
        let cleanup = () => {};
        const onAbort = () => {
            cleanup();
            d.reject(new DOMException('Aborted', 'AbortError'));
        };
        const onTimeout = () => {
            cleanup();
            d.reject(new Error('Timeout'));
        };
        const removeHandlers = setupWaiter(onAbort, onTimeout, opts);
        const entry = {
            value,
            resolve: () => {
                cleanup();
                d.resolve();
            },
            reject: (e: unknown) => {
                cleanup();
                d.reject(e);
            },
        };
        cleanup = () => {
            removeHandlers();
            // Remove from writers if still present
            this.writers.delete(entry);
        };

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
        while (true) yield await this.read();
    }
}

function setupWaiter(
    onAbort: () => void,
    onTimeout: () => void,
    opts: { signal?: AbortSignal; timeoutMs?: number },
): () => void {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    if (opts.signal)
        opts.signal.addEventListener('abort', onAbort, { once: true });
    if (opts.timeoutMs != null) timeout = setTimeout(onTimeout, opts.timeoutMs);
    return () => {
        if (timeout) {
            clearTimeout(timeout);
            timeout = undefined;
        }
        if (opts.signal) opts.signal.removeEventListener('abort', onAbort);
    };
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
