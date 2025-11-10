import { LazyCell } from 'lib/sodium/LazyCell.js';
import { Transaction } from 'lib/sodium/Transaction.js';
import { StreamLoop } from 'lib/sodium/Stream.js';
/* eslint-disable @typescript-eslint/no-this-alias */
/**
 * A forward reference for a {@link Cell} equivalent to the Cell that is referenced.
 */
export class CellLoop extends LazyCell {
    constructor() {
        // @ts-expect-error: Passing a null init value is only valid
        // if loop is called in the same transaction as construction.
        super(null, new StreamLoop());
    }
    /**
     * Resolve the loop to specify what the CellLoop was a forward reference to. It
     * must be invoked inside the same transaction as the place where the CellLoop is used.
     * This requires you to create an explicit transaction with {@link Transaction#run(Lambda0)}
     * or {@link Transaction#runVoid(Runnable)}.
     */
    loop(a_out) {
        const me = this;
        Transaction.execute(() => {
            me.getStream__().loop(a_out.getStream__());
            me.lazyInitValue = a_out.sampleLazy();
        });
    }
    sampleNoTrans__() {
        if (!this.getStream__().assigned__)
            throw new Error('CellLoop sampled before it was looped');
        return super.sampleNoTrans__();
    }
}
