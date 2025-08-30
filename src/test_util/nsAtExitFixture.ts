export type AtExitOnlyNS = { atExit: (f: () => void, id?: string) => void };

export interface AtExitFixture {
    /** A tiny NS stub exposing only `atExit`. Use this where your code expects `ns`. */
    ns: AtExitOnlyNS;

    /** Run all registered exit handlers once, in insertion order. Idempotent. */
    runAll(): void;

    /** Run the handler for a specific id once (if present). */
    run(id?: string): void;

    /** Clear all registrations without running them. Useful for test setup/teardown. */
    reset(): void;

    /** Introspection helpers for assertions. */
    getIds(): string[];
    size(): number;

    /** Hook Jest's afterEach to auto-run-and-reset. */
    hookJest(afterEachLike?: (fn: () => void) => void): void;
}

export function createAtExitFixture(): AtExitFixture {
    const DEFAULT_ID = 'default';

    // Keep insertion order for deterministic execution.
    const handlers = new Map<string, () => void>();

    // Prevent re-entrancy / new registrations during shutdown.
    enum State {
        Idle,
        Exiting,
        Done,
    }
    let state: State = State.Idle;

    const ns: AtExitOnlyNS = {
        atExit(f: () => void, id?: string): void {
            if (state !== State.Idle) {
                // Ignore registrations once shutdown has begun; mirrors "too late to register".
                return;
            }
            const key = id ?? DEFAULT_ID;
            // One callback per id; last-wins per Netscript docs.
            // To preserve overall insertion order, if replacing, we need to re-insert.
            if (handlers.has(key)) {
                console.log(`WARN: atExit handler with id ${key} was replaced`);
                handlers.delete(key);
            }
            handlers.set(key, f);
        },
    };

    function runOne(id: string): void {
        const fn = handlers.get(id);
        if (!fn) return;
        // Remove before running to make repeated calls no-ops even if fn throws.
        handlers.delete(id);
        fn();
    }

    function runAll(): void {
        if (state !== State.Idle) return; // idempotent
        state = State.Exiting;
        try {
            // Snapshot keys to avoid mutation surprises.
            const ids = Array.from(handlers.keys());
            for (const id of ids) runOne(id);
        } finally {
            handlers.clear();
            state = State.Done;
        }
    }

    function run(id?: string): void {
        if (state !== State.Idle) return;
        state = State.Exiting;
        try {
            runOne(id ?? DEFAULT_ID);
        } finally {
            // If others remain registered, we consider shutdown finished for this fixture
            // but leave them so a later explicit runAll() can still exercise them in the same test.
            state = State.Idle;
        }
    }

    function reset(): void {
        handlers.clear();
        state = State.Idle;
    }

    function getIds(): string[] {
        return Array.from(handlers.keys());
    }

    function size(): number {
        return handlers.size;
    }

    function hookJest(afterEachLike?: (fn: () => void) => void): void {
        // Prefer caller-provided afterEach (so this works in any runner),
        // but fall back to global Jest if available.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hook = afterEachLike ?? (globalThis as any).afterEach;
        if (typeof hook === 'function') {
            hook(() => {
                // Ensure all callbacks run even if the test bails out early.
                runAll();
                // Reset so the next test starts clean.
                reset();
            });
        }
    }

    return { ns, runAll, run, reset, getIds, size, hookJest };
}
