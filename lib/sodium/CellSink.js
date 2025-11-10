/* eslint-disable @typescript-eslint/no-unused-vars */
import { Cell } from 'lib/sodium/Cell.js';
import { StreamSink } from 'lib/sodium/StreamSink.js';
/**
 * A cell that allows values to be pushed into it, acting as an interface between the
 * world of I/O and the world of FRP. Code that exports CellSinks for read-only use
 * should downcast to {@link Cell}.
 */
export class CellSink extends Cell {
    /**
     * Construct a writable cell with the specified initial value. If multiple values are
     * sent in the same transaction, the specified function is used to combine them.
     *
     * If the function is not supplied, then an exception will be thrown in this case.
     */
    constructor(initValue, f) {
        super(initValue, new StreamSink(f));
    }
    /**
     * Send a value, modifying the value of the cell. send(A) may not be used inside
     * handlers registered with {@link Stream#listen(Handler)} or {@link Cell#listen(Handler)}.
     * An exception will be thrown, because CellSink is for interfacing I/O to FRP only.
     * You are not meant to use this to define your own primitives.
     * @param a Value to push into the cell.
     */
    send(a) {
        this.getStream__().send(a);
    }
}
