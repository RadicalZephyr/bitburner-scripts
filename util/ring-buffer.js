function nextPow2(v) {
    if (v <= 1)
        return 1;
    v--;
    v |= v >> 1;
    v |= v >> 2;
    v |= v >> 4;
    v |= v >> 8;
    v |= v >> 16;
    // JS numbers are 53-bit, but array lengths are 32-bit; this is fine for our use.
    return v + 1;
}
/**
 * Fixed-capacity ring buffer with O(1) push/shift/peek.
 * Not thread-safe (JS single-threaded event loop); MPMC-safe by design of your Channel
 * because operations are serialized through awaited calls.
 */
export class RingBuffer {
    store;
    head = 0; // index of next item to read
    tail = 0; // index after last written item
    _size = 0;
    cap; // backing array length (possibly rounded)
    mask; // cap - 1 if pow2; else -1
    useMask;
    clearStrategy;
    constructor(capacity, opts = {}) {
        if (!(capacity > 0) || !Number.isFinite(capacity)) {
            throw new Error(`Invalid capacity ${capacity}`);
        }
        const round = opts.roundCapacityToPow2 !== false; // default true
        const rounded = round
            ? nextPow2(Math.ceil(capacity))
            : Math.ceil(capacity);
        this.cap = rounded;
        this.useMask = round;
        this.mask = round ? rounded - 1 : -1;
        this.store = new Array(this.cap);
        this.clearStrategy = opts.clearStrategy ?? 'slot';
    }
    get capacity() {
        return this.cap;
    }
    get size() {
        return this._size;
    }
    isEmpty() {
        return this._size === 0;
    }
    isFull() {
        return this._size === this.cap;
    }
    /** Compute index modulo capacity using either bitmask or % */
    mod(i) {
        return this.useMask ? i & this.mask : i % this.cap;
    }
    /** Add an item; returns false if full (no allocation, no throw). */
    push(v) {
        if (this._size === this.cap)
            return false;
        this.store[this.tail] = v;
        this.tail = this.mod(this.tail + 1);
        this._size++;
        return true;
    }
    /** Remove and return the next item; returns undefined if empty. */
    shift() {
        if (this._size === 0)
            return undefined;
        const idx = this.head;
        const v = this.store[idx];
        if (this.clearStrategy === 'slot')
            this.store[idx] = undefined; // drop ref
        this.head = this.mod(idx + 1);
        this._size--;
        return v;
    }
    /** Return the next item without removing it; undefined if empty. */
    peek() {
        if (this._size === 0)
            return undefined;
        return this.store[this.head];
    }
    /** Drop all items. */
    clear() {
        if (this._size === 0)
            return;
        if (this.clearStrategy === 'buffer') {
            // Fast mass drop of references in one allocation.
            this.store = new Array(this.cap);
        }
        else {
            // Overwrite only occupied slots; O(size) writes, keeps backing array.
            let idx = this.head;
            for (let i = 0; i < this._size; i++) {
                this.store[idx] = undefined;
                idx = this.mod(idx + 1);
            }
        }
        this.head = 0;
        this.tail = 0;
        this._size = 0;
    }
    /** Transfer up to `limit` items into `out` (optional), returning count moved. */
    drain(out, limit = Number.POSITIVE_INFINITY) {
        let n = 0;
        while (n < limit && this._size) {
            const v = this.shift();
            if (out)
                out.push(v);
            n++;
        }
        return n;
    }
    /** Iterate current contents in FIFO order (snapshot; does not mutate). */
    *values() {
        let idx = this.head;
        for (let i = 0; i < this._size; i++) {
            yield this.store[idx];
            idx = this.mod(idx + 1);
        }
    }
}
