/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prefer-const */
import { StreamWithSend } from 'lib/sodium/Stream.js';
import { CoalesceHandler } from 'lib/sodium/CoalesceHandler.js';
import { Transaction } from 'lib/sodium/Transaction.js';
/**
 * A stream that allows values to be pushed into it, acting as an interface between the
 * world of I/O and the world of FRP. Code that exports StreamSinks for read-only use
 * should downcast to {@link Stream}.
 */
export class StreamSink extends StreamWithSend {
    disableListenCheck = false;
    constructor(f) {
        super();
        if (!f)
            f = ((l, r) => {
                throw new Error("send() called more than once per transaction, which isn't allowed. Did you want to combine the events? Then pass a combining function to your StreamSink constructor.");
            });
        this.coalescer = new CoalesceHandler(f, this);
    }
    coalescer;
    send(a) {
        Transaction.execute(() => {
            // We throw this error if we send into FRP logic that has been constructed
            // but nothing is listening to it yet. We need to do it this way because
            // it's the only way to manage memory in a language with no finalizers.
            if (!this.disableListenCheck) {
                if (this.vertex.refCount() == 0) {
                    throw new Error('send() was invoked before listeners were registered');
                }
            }
            //
            if (Transaction.currentTransaction.inCallback > 0)
                throw new Error('You are not allowed to use send() inside a Sodium callback');
            this.coalescer.send_(a);
        });
    }
    listen_(target, h, suppressEarlierFirings) {
        let result = super.listen_(target, h, suppressEarlierFirings);
        this.disableListenCheck = true;
        return result;
    }
}
