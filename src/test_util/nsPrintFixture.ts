export type PrintOnlyNS = { print: (...args: unknown[]) => void };

export interface PrintFixtureOptions {
    /**
     * Provide a shared buffer (e.g., to aggregate across multiple fixtures
     * or to prime the log with initial lines). If omitted, a private buffer is used.
     */
    buffer?: string[];
    /** How args are joined on a line. Matches Bitburner behavior of space-joining. */
    separator?: string; // default: ' '
    /** How each arg is converted to text. Defaults to String(). */
    stringify?: (x: unknown) => string;
    /**
     * Called after each line is produced. Useful to mirror to console or trigger side-effects.
     * NOT invoked during resets/clears—only on `ns.print(...)` calls.
     */
    onPrint?: (line: string, args: unknown[]) => void;
}

export interface PrintFixture {
    /** A tiny NS stub exposing only `print`. Use this where your code expects `ns`. */
    ns: PrintOnlyNS;

    /** Read-only snapshot of current lines. */
    lines(): readonly string[];
    /** Number of logged lines. */
    size(): number;
    /** Last logged line (or last N lines if n>1). */
    last(): string | undefined;
    last(n: number): string[];
    /** True if any line includes/ matches. */
    contains(q: string | RegExp): boolean;
    /** All lines matching the regex. */
    find(re: RegExp): string[];

    /** Join all lines into a single string (newline-separated by default). */
    toString(eol?: string): string;

    /** Mutative helpers on the buffer (sometimes handy in tests). */
    clear(): void; // alias of reset()
    reset(): void;
    pop(): string | undefined;
    shift(): string | undefined;
    splice(start: number, deleteCount?: number, ...items: string[]): string[];

    /** Hook Jest's afterEach to auto-reset. */
    hookJest(afterEachLike?: (fn: () => void) => void): void;
}

export function createPrintFixture(
    opts: PrintFixtureOptions = {},
): PrintFixture {
    const { buffer = [], separator = ' ', stringify = String, onPrint } = opts;

    function makeLine(args: unknown[]): string {
        // NS2 `print` effectively space-joins arguments after string-coercion.
        return args.map(stringify).join(separator);
    }

    const ns: PrintOnlyNS = {
        print(...args: unknown[]): void {
            const line = makeLine(args);
            buffer.push(line);
            if (onPrint) onPrint(line, args);
        },
    };

    function lines(): readonly string[] {
        // expose an immutable view to prevent test code from mutating through the snapshot
        return buffer.slice();
    }

    function size(): number {
        return buffer.length;
    }

    function last(): string | undefined;
    function last(n: number): string[];
    function last(n?: number): string | string[] | undefined {
        if (n === undefined) return buffer[buffer.length - 1];
        if (n <= 0) return [];
        return buffer.slice(-n);
    }

    function contains(q: string | RegExp): boolean {
        if (typeof q === 'string') return buffer.some((l) => l.includes(q));
        return buffer.some((l) => q.test(l));
    }

    function find(re: RegExp): string[] {
        return buffer.filter((l) => re.test(l));
    }

    function toString(eol = '\n'): string {
        return buffer.join(eol);
    }

    function clear(): void {
        buffer.length = 0;
    }

    function reset(): void {
        clear();
    }

    function pop(): string | undefined {
        return buffer.pop();
    }

    function shift(): string | undefined {
        return buffer.shift();
    }

    function splice(
        start: number,
        deleteCount: number,
        ...items: string[]
    ): string[] {
        return buffer.splice(start, deleteCount, ...items);
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
        lines,
        size,
        last,
        contains,
        find,
        toString,
        clear,
        reset,
        pop,
        shift,
        splice,
        hookJest,
    };
}
