import { withPlugins } from 'ns/extend';
import { alivePlugin } from 'ns/plugins/alive';
import { Cell, CellSink, Stream, StreamLoop, Transaction, } from 'lib/sodium';
export function resettableAccumulator(initState, items, reset, f) {
    return Transaction.execute(() => {
        const nextStateLoop = new StreamLoop();
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
export class ApiStream {
    #source = new CellSink(new Stream());
    stream = Cell.switchS(this.#source);
    /**
     * Set the source Stream for this `ApiStream`.
     *
     * @param source - Stream to switch in as the source for the `ApiStream`.
     * @returns A cleanup function that should be called when this
     * `ApiStream` provider is no longer sending updates.
     */
    setSource(source) {
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
export class ApiCell {
    #init;
    #source;
    cell;
    constructor(init) {
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
    setSource(source) {
        this.#source.send(source);
        const unlisten = this.cell.listen(() => null);
        return () => {
            const current = this.cell.sample();
            this.#source.send(new Cell(current));
            unlisten();
        };
    }
}
/**
 * Checks if the given argument is a function.
 * @function
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export function isFunction(f) {
    return typeof f === 'function';
}
export class ApiCellUpdater {
    apiCell;
    pollFn;
    #sink;
    #unlisten;
    cell;
    /**
     * Construct a new ApiCellUpdater.
     *
     * @param apiCell  - ApiCell to update
     * @param pollFn   - Function to produce new values of T
     * @param isEqual  - Predicate function to prevent spurious updates to the ApiCell, default null
     */
    constructor(apiCell, pollFn, isEqual = null) {
        this.apiCell = apiCell;
        this.pollFn = pollFn;
        this.#sink = new CellSink(this.pollFn());
        this.cell = this.#sink;
        if (isFunction(isEqual))
            this.cell = this.cell.calm(isEqual);
        this.#unlisten = this.apiCell.setSource(this.cell);
    }
    unlisten() {
        this.#unlisten();
    }
    poll() {
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
export async function updateCells(ns, periodMs, 
// eslint-disable-next-line @typescript-eslint/no-explicit-any
updaters) {
    if (updaters.length === 0)
        return;
    const nsx = withPlugins(ns, alivePlugin());
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of nsx.alive.loop(periodMs)) {
        Transaction.execute(() => {
            for (const updater of updaters) {
                updater.update();
            }
        });
    }
}
