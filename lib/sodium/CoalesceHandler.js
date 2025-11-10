/* eslint-disable @typescript-eslint/no-unused-vars */
import { Lambda2_deps, Lambda2_toFunction, toSources, } from 'lib/sodium/Lambda.js';
import { Transaction } from 'lib/sodium/Transaction.js';
export class CoalesceHandler {
    constructor(f, out) {
        this.f = Lambda2_toFunction(f);
        this.out = out;
        this.out.getVertex__().sources = this.out
            .getVertex__()
            .sources.concat(toSources(Lambda2_deps(f)));
        this.accumValid = false;
    }
    f;
    out;
    accumValid;
    accum = null;
    /**
     * Push a value into the coalescer.
     *
     * NOTE: _Must_ be called from within a transaction.
     *
     * @param a
     */
    send_(a) {
        if (this.accumValid)
            this.accum = this.f(this.accum, a);
        else {
            Transaction.currentTransaction.prioritized(this.out.getVertex__(), () => {
                this.out.send_(this.accum);
                this.accumValid = false;
                this.accum = null;
            });
            this.accum = a;
            this.accumValid = true;
        }
    }
}
