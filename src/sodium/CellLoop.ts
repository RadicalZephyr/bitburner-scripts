import { Cell } from "sodium/Cell";
import { Lazy } from "sodium/Lazy";
import { LazyCell } from "sodium/LazyCell";
import { Transaction } from "sodium/Transaction";
import { StreamLoop } from "sodium/Stream";

/**
 * A forward reference for a {@link Cell} equivalent to the Cell that is referenced.
 */
export class CellLoop<A> extends LazyCell<A> {
    constructor() {
        super(null, new StreamLoop<A>());
    }

    /**
     * Resolve the loop to specify what the CellLoop was a forward reference to. It
     * must be invoked inside the same transaction as the place where the CellLoop is used.
     * This requires you to create an explicit transaction with {@link Transaction#run(Lambda0)}
     * or {@link Transaction#runVoid(Runnable)}.
     */
    loop(a_out: Cell<A>): void {
        const me = this;
        Transaction.run(() => {
            (<StreamLoop<A>>me.getStream__()).loop(a_out.getStream__());
            me.lazyInitValue = a_out.sampleLazy();
        });
    }

    sampleNoTrans__(): A {
        if (!(<StreamLoop<A>>this.getStream__()).assigned__)
            throw new Error("CellLoop sampled before it was looped");
        return super.sampleNoTrans__();
    }
}
