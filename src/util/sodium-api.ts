import { NS } from '@ns';

import { makeFuid } from 'util/fuid';

import {
    Cell,
    CellSink,
    Stream,
    StreamLoop,
    Transaction,
    Unit,
} from 'lib/sodium';
import { isFunction } from 'lib/typescript-collections/util';

export function resettableAccumulator<Item, State>(
    initState: State,
    items: Stream<Item>,
    reset: Stream<Unit>,
    f: (item: Item, state: State) => State,
): Cell<State> {
    return Transaction.execute(() => {
        const nextStateLoop = new StreamLoop<State>();
        const state = nextStateLoop.hold(initState);
        const nextState = items.snapshot(state, f);
        const resetToInit = reset.map(() => initState);
        // Combine nextState and reset, preferring reset
        const resettableNextState = resetToInit.orElse(nextState);
        nextStateLoop.loop(resettableNextState);
        return state;
    });
}

/**
 * A forward-declaration of a `Stream` whose source can be changed
 * without requiring subscribers to be updated.
 */
export class ApiStream<T> {
    readonly #source: CellSink<Stream<T>> = new CellSink(new Stream());

    stream: Stream<T> = Cell.switchS(this.#source);

    /**
     * Set the source Stream for this `ApiStream`.
     *
     * @param source - Stream to switch in as the source for the `ApiStream`.
     * @returns A cleanup function that should be called when this
     * `ApiStream` provider is no longer sending updates.
     */
    setSource(source: Stream<T>): () => void {
        this.#source.send(source);
        const unlisten = this.stream.listen(() => null);

        return () => {
            this.#source.send(new Stream());
            unlisten();
        };
    }
}

/**
 * A forward-declaration of a `Cell` whose source can be changed
 * without requiring subscribers to be updated.
 */
export class ApiCell<T> {
    #init: T;
    readonly #source: CellSink<Cell<T>>;

    cell: Cell<T>;

    constructor(init: T) {
        this.#init = init;
        this.#source = new CellSink(new Cell(init));
        this.cell = Cell.switchC(this.#source);
    }

    /**
     * Reset to the original default value.
     */
    reset() {
        this.#source.send(new Cell(this.#init));
    }

    /**
     * Set the source Cell for this `ApiCell`.
     *
     * This function also registers a dummy listener to prevent errors
     * from sending updates to this Cell.
     *
     * @param source - Cell to switch in as the source for the `ApiCell`.
     * @returns A cleanup function that should be called when this
     * `ApiCell` provider is no longer sending updates.
     */
    setSource(source: Cell<T>): () => void {
        this.#source.send(source);
        const unlisten = this.cell.listen(() => null);

        return () => {
            const current = this.cell.sample();
            this.#source.send(new Cell(current));
            unlisten();
        };
    }
}

export class ApiCellUpdater<T> {
    readonly #sink: CellSink<T>;
    readonly #unlisten: () => void;

    readonly cell: Cell<T>;

    /**
     * Construct a new ApiCellUpdater.
     *
     * @param apiCell  - ApiCell to update
     * @param pollFn   - Function to produce new values of T
     * @param isEqual  - Predicate function to prevent spurious updates to the ApiCell, default null
     */
    constructor(
        public readonly apiCell: ApiCell<T>,
        public readonly pollFn: () => T,
        isEqual: (a: T, b: T) => boolean = null,
    ) {
        this.#sink = new CellSink(this.pollFn());
        this.cell = this.#sink;
        if (isFunction(isEqual)) this.cell = this.cell.calm(isEqual);
        this.#unlisten = this.apiCell.setSource(this.cell);
    }

    unlisten() {
        this.#unlisten();
    }

    poll(): T {
        return this.pollFn();
    }

    update() {
        this.#sink.send(this.poll());
    }
}

/**
 * Start a task to periodically run an array of ApiCellUpdater using a
 * given polling function.
 *
 * @param ns       - Netscript API instance
 * @param periodMs - The number of milliseconds to sleep between updates
 * @param updaters - An array of ApiCellUpdater to update periodically
 */
export async function updateCells(
    ns: NS,
    periodMs: number,
    updaters: ApiCellUpdater<unknown>[],
) {
    if (updaters.length === 0) return;

    let running = true;
    ns.atExit(() => {
        running = false;
        Transaction.execute(() => {
            for (const updater of updaters) {
                updater.unlisten();
            }
        });
    }, makeFuid(ns));

    while (running) {
        Transaction.execute(() => {
            for (const updater of updaters) {
                updater.update();
            }
        });
        await ns.asleep(periodMs);
    }
}
