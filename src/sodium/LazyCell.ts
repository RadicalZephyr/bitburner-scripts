import { Lazy } from "sodium/Lazy";
import { Cell } from "sodium/Cell";
import { Stream } from "sodium/Stream";
import { Transaction } from "sodium/Transaction";

export class LazyCell<A> extends Cell<A> {
    constructor(lazyInitValue: Lazy<A>, str?: Stream<A>) {
        super(null, null);
        Transaction.run(() => {
            if (str)
                this.setStream(str);
            this.lazyInitValue = lazyInitValue;
        });
    }

    sampleNoTrans__(): A {  // Override
        if (this.value == null && this.lazyInitValue != null) {
            this.value = this.lazyInitValue.get();
            this.lazyInitValue = null;
        }
        return this.value;
    }
}
