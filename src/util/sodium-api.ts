import { Cell, CellSink, Stream } from 'lib/sodium';

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
    readonly #source: CellSink<Cell<T>>;

    cell: Cell<T>;

    constructor(init: T) {
        this.#source = new CellSink(new Cell(init));
        this.cell = Cell.switchC(this.#source);
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
