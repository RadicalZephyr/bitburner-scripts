import { Stream, StreamWithSend } from 'lib/sodium/Stream.js';
import { Vertex, Source } from 'lib/sodium/Vertex.js';
import { Transaction } from 'lib/sodium/Transaction.js';

export class IOAction {
    /*!
     * Convert a function that performs asynchronous I/O taking input A
     * and returning a value of type B into an I/O action of type
     * (sa : Stream<A>) => Stream<B>
     */
    static fromAsync<A, B>(
        performIO: (a: A, result: (b: B) => void) => void,
    ): (sa: Stream<A>) => Stream<B> {
        return (sa: Stream<A>) => {
            const out = new StreamWithSend<B>();
            out.setVertex__(
                new Vertex('map', 0, [
                    new Source(sa.getVertex__(), () => {
                        return sa.listen_(
                            out.getVertex__(),
                            (a: A) => {
                                performIO(a, (b: B) => {
                                    Transaction.execute(() => {
                                        out.send_(b);
                                    });
                                });
                            },
                            false,
                        );
                    }),
                ]),
            );
            return out;
        };
    }
}
