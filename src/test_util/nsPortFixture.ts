/** -----------------------------------------
   Example Jest usage
---------------------------------------------

import { createPortsFixture } from './nsPortFixture';

test('client waits for space before writing', async () => {
  const ports = createPortsFixture({ count: 2, capacityPerPort: 1 }).hookJest();
  const send = ports.port(1); // direct access if needed
  const recv = ports.port(2);

  // Fill send port to force waiting behavior
  send.write({ hello: 1 });

  const waiter = (async () => {
    // your protocol code under test would call ns.getPortHandle(1).tryWrite(...)
    // Here we simulate via the mock:
    const p = ports.ns.getPortHandle(1);
    // Try immediate non-blocking path:
    if (!p.tryWrite({ msg: 'late' })) {
      // emulate your helper's fallback to await nextWrite then write
      await p.nextWrite();
      p.write({ msg: 'late' });
    }
  })();

  // Ensure the promise hasn't resolved yet (port is still full)
  expect(ports.size(1)).toBe(1);

  // Free space
  expect(send.read()).toEqual({ hello: 1 });

  // waiter can now complete and write
  await waiter;
  expect(ports.snapshot(1)).toEqual([{ msg: 'late' }]);
});

*/

import type { NetscriptPort, NS } from '@ns';

/** Matches Bitburner behavior for simple JSON-like values. */
const cloneValue: <T>(v: T) => T =
    typeof structuredClone === 'function'
        ? structuredClone
        : <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const DEFAULT_PORT_COUNT = 100;
const DEFAULT_CAPACITY = 100;

/** Minimal port implementation consistent with Netscript semantics. */
export class MockNetscriptPort implements NetscriptPort {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private queue: any[] = [];
    private readonly capacity: number;
    private nextWriteResolvers: Array<() => void> = [];

    constructor(capacity: number = DEFAULT_CAPACITY) {
        this.capacity = capacity;
    }

    get size(): number {
        return this.queue.length;
    }

    get max(): number {
        return this.capacity;
    }

    /** Evicts oldest when full, returns evicted or undefined (mirrors game semantics closely). */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    write(value: any): any {
        const cloned = cloneValue(value);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let evicted: any = undefined;
        if (this.full()) {
            evicted = this.queue.shift();
        }
        this.queue.push(cloned);
        this.resolveNextWrite();
        return evicted ?? undefined;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tryWrite(value: any): boolean {
        if (this.full()) return false;
        const cloned = cloneValue(value);
        this.queue.push(cloned);
        this.resolveNextWrite();
        return true;
    }

    /** Resolves on the *next* successful write after this call. */
    async nextWrite(): Promise<void> {
        return new Promise<void>((resolve) => {
            this.nextWriteResolvers.push(resolve);
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    read(): any {
        if (this.empty()) return 'NULL PORT DATA';
        return this.queue.shift();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    peek(): any {
        if (this.empty()) return 'NULL PORT DATA';
        return cloneValue(this.queue[0]);
    }

    full(): boolean {
        return this.queue.length >= this.capacity;
    }

    empty(): boolean {
        return this.queue.length === 0;
    }

    clear(): void {
        this.queue = [];
    }

    /** Immutable snapshot of queue content (front..back). */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    snapshot(): any[] {
        return this.queue.map((x) => cloneValue(x));
    }

    private resolveNextWrite(): void {
        const resolvers = this.nextWriteResolvers;
        this.nextWriteResolvers = [];
        for (const r of resolvers) r();
    }
}

/** The tiny NS slice we expose from this fixture. */
export type PortsOnlyNS = Pick<NS, 'getPortHandle'>;

/** Options for the ports fixture. */
export interface PortsFixtureOptions {
    /** Number of available port indices (1..count). Default 100. */
    count?: number;
    /** Capacity (max queue length) for each port. Default 100. */
    capacityPerPort?: number;
}

/** Test helper surface, modeled after your other fixtures. */
export interface PortsFixture {
    /** Minimal `ns` providing only `getPortHandle(i)`. */
    ns: PortsOnlyNS;

    /** Return the mock instance for direct control / assertions. Creates lazily. */
    port(i: number): MockNetscriptPort;

    /** Did we create a port yet? */
    has(i: number): boolean;

    /** Clear one port (if it exists). No-op if not created. */
    clear(i: number): void;

    /** Remove *all* messages from all created ports. */
    clearAll(): void;

    /** Reset fixture to a pristine state (for a fresh test). */
    reset(): void;

    /** List of created port indices (in creation order). */
    getCreated(): number[];

    /** Current size of a port (0 if non-existent). */
    size(i: number): number;

    /** Max capacity of a port (configured). */
    capacity(i: number): number;

    /** Peek front value of a port (Bitburner sentinel if empty or non-existent). */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    peek(i: number): any;

    /** Read and drain entire port contents (front..back). */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    drain(i: number): any[];

    /** Immutable snapshot of a port's queue (front..back). */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    snapshot(i: number): any[];

    /** Convenience bulk-writer for arranging test preconditions. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    writeMany(i: number, values: any[]): void;

    /** Hook Jest's afterEach to auto-reset. */
    hookJest(afterEachLike?: (fn: () => void) => void): void;
}

/** Create a lazy pool for `ns.getPortHandle(i)` + helpers. */
export function createPortsFixture(
    opts: PortsFixtureOptions = {},
): PortsFixture {
    const count = opts.count ?? DEFAULT_PORT_COUNT;
    const capacityPerPort = opts.capacityPerPort ?? DEFAULT_CAPACITY;

    const ports = new Map<number, MockNetscriptPort>();
    const createdOrder: number[] = [];

    function assertIndex(i: number): void {
        if (!Number.isInteger(i) || i < 1 || i > count) {
            throw new RangeError(
                `Port index out of range: ${i} (valid: 1..${count})`,
            );
        }
    }

    function getOrCreate(i: number): MockNetscriptPort {
        assertIndex(i);
        let p = ports.get(i);
        if (!p) {
            p = new MockNetscriptPort(capacityPerPort);
            ports.set(i, p);
            createdOrder.push(i);
        }
        return p;
    }

    const ns: PortsOnlyNS = {
        getPortHandle(i: number): NetscriptPort {
            return getOrCreate(i);
        },
    };

    function port(i: number): MockNetscriptPort {
        return getOrCreate(i);
    }

    function has(i: number): boolean {
        assertIndex(i);
        return ports.has(i);
    }

    function clear(i: number): void {
        if (ports.has(i)) ports.get(i)!.clear();
    }

    function clearAll(): void {
        for (const p of ports.values()) p.clear();
    }

    function reset(): void {
        ports.clear();
        createdOrder.length = 0;
    }

    function getCreated(): number[] {
        return createdOrder.slice();
    }

    function size(i: number): number {
        return ports.get(i)?.size ?? 0;
    }

    function capacity(i: number): number {
        assertIndex(i);
        return capacityPerPort;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function peek(i: number): any {
        return ports.has(i) ? ports.get(i)!.peek() : 'NULL PORT DATA';
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function drain(i: number): any[] {
        const out: unknown[] = [];
        const p = ports.get(i);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!p) return out as any[];
        while (!p.empty()) out.push(p.read());
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return out as any[];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function snapshot(i: number): any[] {
        return ports.get(i)?.snapshot() ?? [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function writeMany(i: number, values: any[]): void {
        const p = getOrCreate(i);
        for (const v of values) p.write(v);
    }

    function hookJest(afterEachLike?: (fn: () => void) => void): void {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hook = afterEachLike ?? (globalThis as any).afterEach;
        if (typeof hook === 'function') {
            hook(() => {
                reset();
            });
        }
    }

    return {
        ns,
        port,
        has,
        clear,
        clearAll,
        reset,
        getCreated,
        size,
        capacity,
        peek,
        drain,
        snapshot,
        writeMany,
        hookJest,
    };
}
