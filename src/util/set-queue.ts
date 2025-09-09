export class SetQueue<T> {
    private set = new Set<T>();

    get size() {
        return this.set.size;
    }

    isEmpty() {
        return this.set.size === 0;
    }

    push(x: T): void {
        this.set.add(x);
    }

    /** Removes and returns oldest element, or undefined. */
    shift(): T | undefined {
        const it = this.set.values();
        const first = it.next();
        if (first.done) return undefined;
        this.set.delete(first.value);
        return first.value;
    }

    /** Remove a specific element (e.g., on abort/timeout). */
    delete(x: T): boolean {
        return this.set.delete(x);
    }

    /** Clear the entire queue */
    clear(): void {
        this.set.clear();
    }

    /** Iterate current elements from oldest to newest (snapshot semantics) */
    *values(): IterableIterator<T> {
        yield* this.set.values();
    }

    /**
     * Drain up to `limit` items into `out` (if provided), FIFO order.
     * Removes the drained items from the list. Returns the count drained.
     * If `limit` is omitted, drains everything.
     */
    drain(limit = Number.POSITIVE_INFINITY): T[] {
        if (limit <= 0 || this.set.size === 0) return [];

        const out: T[] = [];

        let n = 0;
        // Repeatedly shift to preserve FIFO and to avoid mutating during iteration hazards.
        while (n < limit) {
            const v = this.shift();
            if (v === undefined) break;
            out.push(v);
            n++;
        }
        return out;
    }
}
