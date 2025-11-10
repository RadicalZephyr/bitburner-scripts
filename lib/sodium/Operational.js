/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prefer-const */
import { Lambda1_deps, Lambda1_toFunction, Lambda2_deps, Lambda2_toFunction, Lambda3_deps, Lambda3_toFunction, Lambda4_deps, Lambda4_toFunction, Lambda5_deps, Lambda5_toFunction, Lambda6_deps, Lambda6_toFunction, toSources, } from 'lib/sodium/Lambda.js';
import { Lazy } from 'lib/sodium/Lazy.js';
import { Listener } from 'lib/sodium/Listener.js';
import { Tuple2 } from 'lib/sodium/Tuple2.js';
//import { StreamLoop } from "sodium/StreamLoop";
import * as Z from 'lib/sanctuary-type-classes.js';
import { Transaction } from 'lib/sodium/Transaction.js';
import { Unit } from 'lib/sodium/Unit.js';
import { Source, Vertex } from 'lib/sodium/Vertex.js';
export class Operational {
    /**
     * A stream that gives the updates/steps for a {@link Cell}.
     * <P>
     * This is an OPERATIONAL primitive, which is not part of the main Sodium
     * API. It breaks the property of non-detectability of cell steps/updates.
     * The rule with this primitive is that you should only use it in functions
     * that do not allow the caller to detect the cell updates.
     */
    static updates(c) {
        /*  Don't think this is needed
        const out = new StreamWithSend<A>();
        out.setVertex__(new Vertex("updates", 0, [
                new Source(
                    c.getStream__().getVertex__(),
                    () => {
                        return c.getStream__().listen_(out.getVertex__(), (a : A) => {
                            out.send_(a);
                        }, false);
                    }
                ),
                new Source(
                    c.getVertex__(),
                    () => {
                        return () => { };
                    }
                )
            ]
        ));
        return out;
        */
        return c.getStream__();
    }
    /**
     * A stream that is guaranteed to fire once in the transaction where value() is invoked, giving
     * the current value of the cell, and thereafter behaves like {@link updates(Cell)},
     * firing for each update/step of the cell's value.
     * <P>
     * This is an OPERATIONAL primitive, which is not part of the main Sodium
     * API. It breaks the property of non-detectability of cell steps/updates.
     * The rule with this primitive is that you should only use it in functions
     * that do not allow the caller to detect the cell updates.
     */
    static value(c) {
        return Transaction.execute(() => {
            const sSpark = new StreamWithSend();
            Transaction.currentTransaction.prioritized(sSpark.getVertex__(), () => {
                sSpark.send_(Unit.UNIT);
            });
            const sInitial = sSpark.snapshot1(c);
            return Operational.updates(c).orElse(sInitial);
        });
    }
    /**
     * Push each event onto a new transaction guaranteed to come before the next externally
     * initiated transaction. Same as {@link split(Stream)} but it works on a single value.
     */
    static defer(s) {
        return Operational.split(s.map((a) => {
            return [a];
        }));
    }
    /**
     * Push each event in the list onto a newly created transaction guaranteed
     * to come before the next externally initiated transaction. Note that the semantics
     * are such that two different invocations of split() can put events into the same
     * new transaction, so the resulting stream's events could be simultaneous with
     * events output by split() or {@link defer(Stream)} invoked elsewhere in the code.
     */
    static split(s) {
        const out = new StreamWithSend(undefined);
        out.setVertex__(new Vertex('split', 0, [
            new Source(s.getVertex__(), () => {
                out.getVertex__().childrn.push(s.getVertex__());
                let cleanups = [];
                cleanups.push(s.listen_(Vertex.NULL, (as) => {
                    for (let i = 0; i < as.length; i++) {
                        Transaction.currentTransaction.post(i, () => {
                            Transaction.execute(() => {
                                out.send_(as[i]);
                            });
                        });
                    }
                }, false));
                cleanups.push(() => {
                    let chs = out.getVertex__().childrn;
                    for (let i = chs.length - 1; i >= 0; --i) {
                        if (chs[i] == s.getVertex__()) {
                            chs.splice(i, 1);
                            break;
                        }
                    }
                });
                return () => {
                    cleanups.forEach((cleanup) => cleanup());
                    cleanups.splice(0, cleanups.length);
                };
            }),
        ]));
        return out;
    }
}
class MergeState {
    constructor() { }
    left = null;
    left_present = false;
    right = null;
    right_present = false;
}
export class Stream {
    constructor(vertex) {
        this.vertex = vertex ? vertex : new Vertex('Stream', 0, []);
    }
    getVertex__() {
        return this.vertex;
    }
    vertex;
    listeners = [];
    firings = [];
    /**
     * Transform the stream's event values according to the supplied function, so the returned
     * Stream's event values reflect the value of the function applied to the input
     * Stream's event values.
     * @param f Function to apply to convert the values. It may construct FRP logic or use
     *    {@link Cell#sample()} in which case it is equivalent to {@link Stream#snapshot(Cell)}ing the
     *    cell. Apart from this the function must be <em>referentially transparent</em>.
     */
    map(f) {
        const out = new StreamWithSend();
        const ff = Lambda1_toFunction(f);
        out.vertex = new Vertex('map', 0, [
            new Source(this.vertex, () => {
                return this.listen_(out.vertex, (a) => {
                    out.send_(ff(a));
                }, false);
            }),
        ].concat(toSources(Lambda1_deps(f))));
        return out;
    }
    /**
     * Transform the stream's event values into the specified constant value.
     * @param b Constant value.
     */
    mapTo(b) {
        const out = new StreamWithSend();
        out.vertex = new Vertex('mapTo', 0, [
            new Source(this.vertex, () => {
                return this.listen_(out.vertex, (a) => {
                    out.send_(b);
                }, false);
            }),
        ]);
        return out;
    }
    /**
     * Variant of {@link Stream#merge(Stream, Lambda2)} that merges two streams and will drop an event
     * in the simultaneous case.
     * <p>
     * In the case where two events are simultaneous (i.e. both
     * within the same transaction), the event from <em>this</em> will take precedence, and
     * the event from <em>s</em> will be dropped.
     * If you want to specify your own combining function, use {@link Stream#merge(Stream, Lambda2)}.
     * s1.orElse(s2) is equivalent to s1.merge(s2, (l, r) -&gt; l).
     * <p>
     * The name orElse() is used instead of merge() to make it really clear that care should
     * be taken, because events can be dropped.
     */
    orElse(s) {
        return this.merge(s, (left, right) => {
            return left;
        });
    }
    /**
     * Merge two streams of the same type into one, so that events on either input appear
     * on the returned stream.
     * <p>
     * If the events are simultaneous (that is, one event from this and one from <em>s</em>
     * occurring in the same transaction), combine them into one using the specified combining function
     * so that the returned stream is guaranteed only ever to have one event per transaction.
     * The event from <em>this</em> will appear at the left input of the combining function, and
     * the event from <em>s</em> will appear at the right.
     * @param f Function to combine the values. It may construct FRP logic or use
     *    {@link Cell#sample()}. Apart from this the function must be <em>referentially transparent</em>.
     */
    merge(s, f) {
        const ff = Lambda2_toFunction(f);
        const mergeState = new MergeState();
        let pumping = false;
        const out = new StreamWithSend();
        const pump = () => {
            if (pumping) {
                return;
            }
            pumping = true;
            Transaction.currentTransaction.prioritized(out.getVertex__(), () => {
                if (mergeState.left_present && mergeState.right_present) {
                    out.send_(ff(mergeState.left, mergeState.right));
                }
                else if (mergeState.left_present) {
                    out.send_(mergeState.left);
                }
                else if (mergeState.right_present) {
                    out.send_(mergeState.right);
                }
                mergeState.left = null;
                mergeState.left_present = false;
                mergeState.right = null;
                mergeState.right_present = false;
                pumping = false;
            });
        };
        const vertex = new Vertex('merge', 0, [
            new Source(this.vertex, () => this.listen_(out.vertex, (a) => {
                mergeState.left = a;
                mergeState.left_present = true;
                pump();
            }, false)),
            new Source(s.vertex, () => s.listen_(out.vertex, (a) => {
                mergeState.right = a;
                mergeState.right_present = true;
                pump();
            }, false)),
        ].concat(toSources(Lambda2_deps(f))));
        out.vertex = vertex;
        return out;
    }
    /**
     * Return a stream that only outputs events for which the predicate returns true.
     */
    filter(f) {
        const out = new StreamWithSend();
        const ff = Lambda1_toFunction(f);
        out.vertex = new Vertex('filter', 0, [
            new Source(this.vertex, () => {
                return this.listen_(out.vertex, (a) => {
                    if (ff(a))
                        out.send_(a);
                }, false);
            }),
        ].concat(toSources(Lambda1_deps(f))));
        return out;
    }
    /**
     * Return a stream that only outputs events that have present
     * values, discarding null values.
     */
    filterNotNull() {
        const out = new StreamWithSend();
        out.vertex = new Vertex('filterNotNull', 0, [
            new Source(this.vertex, () => {
                return this.listen_(out.vertex, (a) => {
                    if (a != null)
                        out.send_(a);
                }, false);
            }),
        ]);
        return out;
    }
    /**
     * Return a stream that only outputs events from the input stream
     * when the specified cell's value is true.
     */
    gate(c) {
        return this.snapshot(c, (a, pred) => {
            return pred ? a : null;
        }).filterNotNull();
    }
    /**
     * Variant of {@link snapshot(Cell, Lambda2)} that captures the cell's value
     * at the time of the event firing, ignoring the stream's value.
     */
    snapshot1(c) {
        const out = new StreamWithSend();
        out.vertex = new Vertex('snapshot1', 0, [
            new Source(this.vertex, () => {
                return this.listen_(out.vertex, (a) => {
                    out.send_(c.sampleNoTrans__());
                }, false);
            }),
            new Source(c.getVertex__(), null),
        ]);
        return out;
    }
    /**
     * Return a stream whose events are the result of the combination using the specified
     * function of the input stream's event value and the value of the cell at that time.
     * <P>
     * There is an implicit delay: State updates caused by event firings being held with
     * {@link Stream#hold(Object)} don't become visible as the cell's current value until
     * the following transaction. To put this another way, {@link Stream#snapshot(Cell, Lambda2)}
     * always sees the value of a cell as it was before any state changes from the current
     * transaction.
     */
    snapshot(b, f_) {
        const out = new StreamWithSend();
        const ff = Lambda2_toFunction(f_);
        out.vertex = new Vertex('snapshot', 0, [
            new Source(this.vertex, () => {
                return this.listen_(out.vertex, (a) => {
                    out.send_(ff(a, b.sampleNoTrans__()));
                }, false);
            }),
            new Source(b.getVertex__(), null),
        ].concat(toSources(Lambda2_deps(f_))));
        return out;
    }
    /**
     * Return a stream whose events are the result of the combination using the specified
     * function of the input stream's event value and the value of the cells at that time.
     * <P>
     * There is an implicit delay: State updates caused by event firings being held with
     * {@link Stream#hold(Object)} don't become visible as the cell's current value until
     * the following transaction. To put this another way, snapshot()
     * always sees the value of a cell as it was before any state changes from the current
     * transaction.
     */
    snapshot3(b, c, f_) {
        const out = new StreamWithSend();
        const ff = Lambda3_toFunction(f_);
        out.vertex = new Vertex('snapshot', 0, [
            new Source(this.vertex, () => {
                return this.listen_(out.vertex, (a) => {
                    out.send_(ff(a, b.sampleNoTrans__(), c.sampleNoTrans__()));
                }, false);
            }),
            new Source(b.getVertex__(), null),
            new Source(c.getVertex__(), null),
        ].concat(toSources(Lambda3_deps(f_))));
        return out;
    }
    /**
     * Return a stream whose events are the result of the combination using the specified
     * function of the input stream's event value and the value of the cells at that time.
     * <P>
     * There is an implicit delay: State updates caused by event firings being held with
     * {@link Stream#hold(Object)} don't become visible as the cell's current value until
     * the following transaction. To put this another way, snapshot()
     * always sees the value of a cell as it was before any state changes from the current
     * transaction.
     */
    snapshot4(b, c, d, f_) {
        const out = new StreamWithSend();
        const ff = Lambda4_toFunction(f_);
        out.vertex = new Vertex('snapshot', 0, [
            new Source(this.vertex, () => {
                return this.listen_(out.vertex, (a) => {
                    out.send_(ff(a, b.sampleNoTrans__(), c.sampleNoTrans__(), d.sampleNoTrans__()));
                }, false);
            }),
            new Source(b.getVertex__(), null),
            new Source(c.getVertex__(), null),
            new Source(d.getVertex__(), null),
        ].concat(toSources(Lambda4_deps(f_))));
        return out;
    }
    /**
     * Return a stream whose events are the result of the combination using the specified
     * function of the input stream's event value and the value of the cells at that time.
     * <P>
     * There is an implicit delay: State updates caused by event firings being held with
     * {@link Stream#hold(Object)} don't become visible as the cell's current value until
     * the following transaction. To put this another way, snapshot()
     * always sees the value of a cell as it was before any state changes from the current
     * transaction.
     */
    snapshot5(b, c, d, e, f_) {
        const out = new StreamWithSend();
        const ff = Lambda5_toFunction(f_);
        out.vertex = new Vertex('snapshot', 0, [
            new Source(this.vertex, () => {
                return this.listen_(out.vertex, (a) => {
                    out.send_(ff(a, b.sampleNoTrans__(), c.sampleNoTrans__(), d.sampleNoTrans__(), e.sampleNoTrans__()));
                }, false);
            }),
            new Source(b.getVertex__(), null),
            new Source(c.getVertex__(), null),
            new Source(d.getVertex__(), null),
            new Source(e.getVertex__(), null),
        ].concat(toSources(Lambda5_deps(f_))));
        return out;
    }
    /**
     * Return a stream whose events are the result of the combination using the specified
     * function of the input stream's event value and the value of the cells at that time.
     * <P>
     * There is an implicit delay: State updates caused by event firings being held with
     * {@link Stream#hold(Object)} don't become visible as the cell's current value until
     * the following transaction. To put this another way, snapshot()
     * always sees the value of a cell as it was before any state changes from the current
     * transaction.
     */
    snapshot6(b, c, d, e, f, f_) {
        const out = new StreamWithSend();
        const ff = Lambda6_toFunction(f_);
        out.vertex = new Vertex('snapshot', 0, [
            new Source(this.vertex, () => {
                return this.listen_(out.vertex, (a) => {
                    out.send_(ff(a, b.sampleNoTrans__(), c.sampleNoTrans__(), d.sampleNoTrans__(), e.sampleNoTrans__(), f.sampleNoTrans__()));
                }, false);
            }),
            new Source(b.getVertex__(), null),
            new Source(c.getVertex__(), null),
            new Source(d.getVertex__(), null),
            new Source(e.getVertex__(), null),
            new Source(f.getVertex__(), null),
        ].concat(toSources(Lambda6_deps(f_))));
        return out;
    }
    /**
     * Create a {@link Cell} with the specified initial value, that is updated
     * by this stream's event values.
     * <p>
     * There is an implicit delay: State updates caused by event firings don't become
     * visible as the cell's current value as viewed by {@link Stream#snapshot(Cell, Lambda2)}
     * until the following transaction. To put this another way,
     * {@link Stream#snapshot(Cell, Lambda2)} always sees the value of a cell as it was before
     * any state changes from the current transaction.
     */
    hold(initValue) {
        return new Cell(initValue, this);
    }
    /**
     * A variant of {@link hold(Object)} with an initial value captured by {@link Cell#sampleLazy()}.
     */
    holdLazy(initValue) {
        return new LazyCell(initValue, this);
    }
    /**
     * Transform an event with a generalized state loop (a Mealy machine). The function
     * is passed the input and the old state and returns the new state and output value.
     * @param f Function to apply to update the state. It may construct FRP logic or use
     *    {@link Cell#sample()} in which case it is equivalent to {@link Stream#snapshot(Cell)}ing the
     *    cell. Apart from this the function must be <em>referentially transparent</em>.
     */
    collect(initState, f) {
        return this.collectLazy(new Lazy(() => {
            return initState;
        }), f);
    }
    /**
     * A variant of {@link collect(Object, Lambda2)} that takes an initial state returned by
     * {@link Cell#sampleLazy()}.
     */
    collectLazy(initState, f) {
        const ea = this;
        return Transaction.execute(() => {
            const es = new StreamLoop(), s = es.holdLazy(initState), ebs = ea.snapshot(s, f), eb = ebs.map((bs) => {
                return bs.a;
            }), es_out = ebs.map((bs) => {
                return bs.b;
            });
            es.loop(es_out);
            return eb;
        });
    }
    /**
     * Accumulate on input event, outputting the new state each time.
     * @param f Function to apply to update the state. It may construct FRP logic or use
     *    {@link Cell#sample()} in which case it is equivalent to {@link Stream#snapshot(Cell)}ing the
     *    cell. Apart from this the function must be <em>referentially transparent</em>.
     */
    accum(initState, f) {
        return this.accumLazy(new Lazy(() => {
            return initState;
        }), f);
    }
    /**
     * A variant of {@link accum(Object, Lambda2)} that takes an initial state returned by
     * {@link Cell#sampleLazy()}.
     */
    accumLazy(initState, f) {
        const ea = this;
        return Transaction.execute(() => {
            const es = new StreamLoop(), s = es.holdLazy(initState), es_out = ea.snapshot(s, f);
            es.loop(es_out);
            return es_out.holdLazy(initState);
        });
    }
    /**
     * Return a stream that outputs only one value: the next event of the
     * input stream, starting from the transaction in which once() was invoked.
     */
    once() {
        /*
            return Transaction.run(() => {
                const ev = this,
                    out = new StreamWithSend<A>();
                let la : () => void = null;
                la = ev.listen_(out.vertex, (a : A) => {
                    if (la !== null) {
                        out.send_(a);
                        la();
                        la = null;
                    }
                }, false);
                return out;
            });
            */
        // We can't use the implementation above, beacuse deregistering
        // listeners triggers the exception
        // "send() was invoked before listeners were registered"
        // We can revisit this another time. For now we will use the less
        // efficient implementation below.
        const me = this;
        return Transaction.execute(() => me.gate(me.mapTo(false).hold(true)));
    }
    listen(h) {
        return Transaction.execute(() => {
            return this.listen_(Vertex.NULL, h, false);
        });
    }
    listen_(target, h, suppressEarlierFirings) {
        if (this.vertex.register(target))
            Transaction.currentTransaction.requestRegen();
        const listener = new Listener(h, target);
        this.listeners.push(listener);
        if (!suppressEarlierFirings && this.firings.length != 0) {
            const firings = this.firings.slice();
            Transaction.currentTransaction.prioritized(target, () => {
                // Anything sent already in this transaction must be sent now so that
                // there's no order dependency between send and listen.
                for (let i = 0; i < firings.length; i++)
                    h(firings[i]);
            });
        }
        return () => {
            let removed = false;
            for (let i = 0; i < this.listeners.length; i++) {
                if (this.listeners[i] == listener) {
                    this.listeners.splice(i, 1);
                    removed = true;
                    break;
                }
            }
            if (removed)
                this.vertex.deregister(target);
        };
    }
    /**
     * Fantasy-land Algebraic Data Type Compatability.
     * Stream satisfies the Functor and Monoid Categories (and hence Semigroup)
     * @see {@link https://github.com/fantasyland/fantasy-land} for more info
     */
    //map :: Functor f => f a ~> (a -> b) -> f b
    'fantasy-land/map'(f) {
        return this.map(f);
    }
    //concat :: Semigroup a => a ~> a -> a
    'fantasy-land/concat'(a) {
        return this.merge(a, (left, right) => {
            return Z.Semigroup.test(left) ? Z.concat(left, right) : left;
        });
    }
    //empty :: Monoid m => () -> m
    'fantasy-land/empty'() {
        return new Stream();
    }
}
export class StreamWithSend extends Stream {
    constructor(vertex) {
        super(vertex);
    }
    setVertex__(vertex) {
        // TO DO figure out how to hide this
        this.vertex = vertex;
    }
    send_(a) {
        if (this.firings.length == 0)
            Transaction.currentTransaction.last(() => {
                this.firings = [];
            });
        this.firings.push(a);
        const listeners = this.listeners.slice();
        for (let i = 0; i < listeners.length; i++) {
            const h = listeners[i].h;
            Transaction.currentTransaction.prioritized(listeners[i].target, () => {
                Transaction.currentTransaction.inCallback++;
                try {
                    h(a);
                    Transaction.currentTransaction.inCallback--;
                }
                catch (err) {
                    Transaction.currentTransaction.inCallback--;
                    throw err;
                }
            });
        }
    }
}
/**
 * A forward reference for a {@link Stream} equivalent to the Stream that is referenced.
 */
export class StreamLoop extends StreamWithSend {
    assigned__ = false; // to do: Figure out how to hide this
    constructor() {
        super();
        this.vertex.name = 'StreamLoop';
        if (Transaction.currentTransaction === null)
            throw new Error('StreamLoop/CellLoop must be used within an explicit transaction');
    }
    /**
     * Resolve the loop to specify what the StreamLoop was a forward reference to. It
     * must be invoked inside the same transaction as the place where the StreamLoop is used.
     * This requires you to create an explicit transaction with {@link Transaction#run(Lambda0)}
     * or {@link Transaction#runVoid(Runnable)}.
     */
    loop(sa_out) {
        if (this.assigned__)
            throw new Error('StreamLoop looped more than once');
        this.assigned__ = true;
        this.vertex.addSource(new Source(sa_out.getVertex__(), () => {
            return sa_out.listen_(this.vertex, (a) => {
                this.send_(a);
            }, false);
        }));
    }
}
class LazySample {
    constructor(cell) {
        this.cell = cell;
    }
    cell;
    hasValue = false;
    value = null;
}
class ApplyState {
    constructor() { }
    f = null;
    f_present = false;
    a = null;
    a_present = false;
}
export class Cell {
    // @ts-expect-error: this.setStream definitely sets this value in the constructor
    str;
    value;
    valueUpdate = null;
    cleanup = null;
    lazyInitValue = null; // Used by LazyCell
    // @ts-expect-error: this.setStream definitely sets this value in the constructor
    vertex;
    constructor(initValue, str) {
        this.value = initValue;
        if (!str) {
            this.str = new Stream();
            this.vertex = new Vertex('ConstCell', 0, []);
        }
        else
            Transaction.execute(() => this.setStream(str));
    }
    setStream(str) {
        this.str = str;
        const me = this, src = new Source(str.getVertex__(), () => {
            return str.listen_(me.vertex, (a) => {
                if (me.valueUpdate == null) {
                    Transaction.currentTransaction.last(() => {
                        me.value = me.valueUpdate;
                        me.lazyInitValue = null;
                        me.valueUpdate = null;
                    });
                }
                me.valueUpdate = a;
            }, false);
        });
        this.vertex = new Vertex('Cell', 0, [src]);
        // We do a trick here of registering the source for the duration of the current
        // transaction so that we are guaranteed to catch any stream events that
        // occur in the same transaction.
        //
        // A new temporary vertex null is constructed here as a performance work-around to avoid
        // having too many children in Vertex.NULL as a deregister operation is O(n^2) where
        // n is the number of children in the vertex.
        let tmpVertexNULL = new Vertex('Cell::setStream', 1e12, []);
        this.vertex.register(tmpVertexNULL);
        Transaction.currentTransaction.last(() => {
            this.vertex.deregister(tmpVertexNULL);
        });
    }
    getVertex__() {
        return this.vertex;
    }
    getStream__() {
        // TO DO: Figure out how to hide this
        return this.str;
    }
    /**
     * Sample the cell's current value.
     * <p>
     * It should generally be avoided in favour of {@link listen(Handler)} so you don't
     * miss any updates, but in many circumstances it makes sense.
     * <p>
     * NOTE: In the Java and other versions of Sodium, using sample() inside map(), filter() and
     * merge() is encouraged. In the Javascript/Typescript version, not so much, for the
     * following reason: The memory management is different in the Javascript version, and this
     * requires us to track all dependencies. In order for the use of sample() inside
     * a closure to be correct, the cell that was sample()d inside the closure would have to be
     * declared explicitly using the helpers lambda1(), lambda2(), etc. Because this is
     * something that can be got wrong, we don't encourage this kind of use of sample() in
     * Javascript. Better and simpler to use snapshot().
     * <p>
     * NOTE: If you need to sample() a cell, you have to make sure it's "alive" in terms of
     * memory management or it will ignore updates. To make a cell work correctly
     * with sample(), you have to ensure that it's being used. One way to guarantee this is
     * to register a dummy listener on the cell. It will also work to have it referenced
     * by something that is ultimately being listened to.
     */
    sample() {
        return Transaction.execute(() => {
            return this.sampleNoTrans__();
        });
    }
    sampleNoTrans__() {
        // TO DO figure out how to hide this
        return this.value;
    }
    /**
     * A variant of {@link sample()} that works with {@link CellLoop}s when they haven't been looped yet.
     * It should be used in any code that's general enough that it could be passed a {@link CellLoop}.
     * @see Stream#holdLazy(Lazy) Stream.holdLazy()
     */
    sampleLazy() {
        const me = this;
        return Transaction.execute(() => me.sampleLazyNoTrans__());
    }
    sampleLazyNoTrans__() {
        // TO DO figure out how to hide this
        const me = this, s = new LazySample(me);
        Transaction.currentTransaction.sample(() => {
            s.value =
                me.valueUpdate != null ? me.valueUpdate : me.sampleNoTrans__();
            s.hasValue = true;
            s.cell = null;
        });
        return new Lazy(() => {
            if (s.hasValue)
                return s.value;
            else
                return s.cell.sample();
        });
    }
    /**
     * Transform the cell's value according to the supplied function, so the returned Cell
     * always reflects the value of the function applied to the input Cell's value.
     * @param f Function to apply to convert the values. It must be <em>referentially transparent</em>.
     */
    map(f) {
        const c = this;
        return Transaction.execute(() => Operational.updates(c)
            .map(f)
            .holdLazy(c.sampleLazy().map(Lambda1_toFunction(f))));
    }
    /**
     * Lift a binary function into cells, so the returned Cell always reflects the specified
     * function applied to the input cells' values.
     * @param fn Function to apply. It must be <em>referentially transparent</em>.
     */
    lift(b, fn0) {
        const fn = Lambda2_toFunction(fn0), cf = this.map((aa) => (bb) => fn(aa, bb));
        return Cell.apply(cf, b, toSources(Lambda2_deps(fn0)));
    }
    /**
     * Lift a ternary function into cells, so the returned Cell always reflects the specified
     * function applied to the input cells' values.
     * @param fn Function to apply. It must be <em>referentially transparent</em>.
     */
    lift3(b, c, fn0) {
        const fn = Lambda3_toFunction(fn0), mf = (aa) => (bb) => (cc) => fn(aa, bb, cc), cf = this.map(mf);
        return Cell.apply(Cell.apply(cf, b), c, toSources(Lambda3_deps(fn0)));
    }
    /**
     * Lift a quaternary function into cells, so the returned Cell always reflects the specified
     * function applied to the input cells' values.
     * @param fn Function to apply. It must be <em>referentially transparent</em>.
     */
    lift4(b, c, d, fn0) {
        const fn = Lambda4_toFunction(fn0), mf = (aa) => (bb) => (cc) => (dd) => fn(aa, bb, cc, dd), cf = this.map(mf);
        return Cell.apply(Cell.apply(Cell.apply(cf, b), c), d, toSources(Lambda4_deps(fn0)));
    }
    /**
     * Lift a 5-argument function into cells, so the returned Cell always reflects the specified
     * function applied to the input cells' values.
     * @param fn Function to apply. It must be <em>referentially transparent</em>.
     */
    lift5(b, c, d, e, fn0) {
        const fn = Lambda5_toFunction(fn0), mf = (aa) => (bb) => (cc) => (dd) => (ee) => fn(aa, bb, cc, dd, ee), cf = this.map(mf);
        return Cell.apply(Cell.apply(Cell.apply(Cell.apply(cf, b), c), d), e, toSources(Lambda5_deps(fn0)));
    }
    /**
     * Lift a 6-argument function into cells, so the returned Cell always reflects the specified
     * function applied to the input cells' values.
     * @param fn Function to apply. It must be <em>referentially transparent</em>.
     */
    lift6(b, c, d, e, f, fn0) {
        const fn = Lambda6_toFunction(fn0), mf = (aa) => (bb) => (cc) => (dd) => (ee) => (ff) => fn(aa, bb, cc, dd, ee, ff), cf = this.map(mf);
        return Cell.apply(Cell.apply(Cell.apply(Cell.apply(Cell.apply(cf, b), c), d), e), f, toSources(Lambda6_deps(fn0)));
    }
    /**
     * High order depenency traking. If any newly created sodium objects within a value of a cell of a sodium object
     * happen to accumulate state, this method will keep the accumulation of state up to date.
     */
    tracking(extractor) {
        const out = new StreamWithSend();
        let vertex = new Vertex('tracking', 0, [
            new Source(this.vertex, () => {
                let cleanup2 = () => { };
                let updateDeps = (a) => {
                    let lastCleanups2 = cleanup2;
                    let deps = extractor(a).map((dep) => dep.getVertex__());
                    for (let i = 0; i < deps.length; ++i) {
                        let dep = deps[i];
                        vertex.childrn.push(dep);
                        dep.increment(Vertex.NULL);
                    }
                    cleanup2 = () => {
                        for (let i = 0; i < deps.length; ++i) {
                            let dep = deps[i];
                            for (let j = 0; j < vertex.childrn.length; ++j) {
                                if (vertex.childrn[j] === dep) {
                                    vertex.childrn.splice(j, 1);
                                    break;
                                }
                            }
                            dep.decrement(Vertex.NULL);
                        }
                    };
                    lastCleanups2();
                };
                updateDeps(this.sample());
                const cleanup1 = Operational.updates(this).listen_(vertex, (a) => {
                    updateDeps(a);
                    out.send_(a);
                }, false);
                return () => {
                    cleanup1();
                    cleanup2();
                };
            }),
        ]);
        out.setVertex__(vertex);
        return out.holdLazy(this.sampleLazy());
    }
    /**
     * Lift an array of cells into a cell of an array.
     */
    static liftArray(ca) {
        return Cell._liftArray(ca, 0, ca.length);
    }
    static _liftArray(ca, fromInc, toExc) {
        if (toExc - fromInc == 0) {
            return new Cell([]);
        }
        else if (toExc - fromInc == 1) {
            return ca[fromInc].map((a) => [a]);
        }
        else {
            let pivot = Math.floor((fromInc + toExc) / 2);
            // the thunk boxing/unboxing here is a performance hack for lift when there are simutaneous changing cells.
            return Cell._liftArray(ca, fromInc, pivot)
                .lift(Cell._liftArray(ca, pivot, toExc), (array1, array2) => () => array1.concat(array2))
                .map((x) => x());
        }
    }
    /**
     * Apply a value inside a cell to a function inside a cell. This is the
     * primitive for all function lifting.
     */
    static apply(cf, ca, sources) {
        return Transaction.execute(() => {
            let pumping = false;
            const state = new ApplyState(), out = new StreamWithSend(), cf_updates = Operational.updates(cf), ca_updates = Operational.updates(ca), pump = () => {
                if (pumping) {
                    return;
                }
                pumping = true;
                Transaction.currentTransaction.prioritized(out.getVertex__(), () => {
                    let f = state.f_present
                        ? state.f
                        : cf.sampleNoTrans__();
                    let a = state.a_present
                        ? state.a
                        : ca.sampleNoTrans__();
                    out.send_(f(a));
                    pumping = false;
                });
            }, src1 = new Source(cf_updates.getVertex__(), () => {
                return cf_updates.listen_(out.getVertex__(), (f) => {
                    state.f = f;
                    state.f_present = true;
                    pump();
                }, false);
            }), src2 = new Source(ca_updates.getVertex__(), () => {
                return ca_updates.listen_(out.getVertex__(), (a) => {
                    state.a = a;
                    state.a_present = true;
                    pump();
                }, false);
            });
            out.setVertex__(new Vertex('apply', 0, [src1, src2].concat(sources ? sources : [])));
            return out.holdLazy(new Lazy(() => cf.sampleNoTrans__()(ca.sampleNoTrans__())));
        });
    }
    /**
     * Unwrap a cell inside another cell to give a time-varying cell implementation.
     */
    static switchC(cca) {
        return Transaction.execute(() => {
            const za = cca.sampleLazy().map((ba) => ba.sample()), out = new StreamWithSend();
            let outValue = null;
            let pumping = false;
            const pump = () => {
                if (pumping) {
                    return;
                }
                pumping = true;
                Transaction.currentTransaction.prioritized(out.getVertex__(), () => {
                    out.send_(outValue);
                    outValue = null;
                    pumping = false;
                });
            };
            let last_ca = null;
            const cca_value = Operational.value(cca), src = new Source(cca_value.getVertex__(), () => {
                let kill2 = last_ca === null
                    ? null
                    : Operational.value(last_ca).listen_(out.getVertex__(), (a) => {
                        outValue = a;
                        pump();
                    }, false);
                const kill1 = cca_value.listen_(out.getVertex__(), (ca) => {
                    last_ca = ca;
                    // Connect before disconnect to avoid memory bounce, when switching to same cell twice.
                    let nextKill2 = Operational.value(ca).listen_(out.getVertex__(), (a) => {
                        outValue = a;
                        pump();
                    }, false);
                    if (kill2 !== null)
                        kill2();
                    kill2 = nextKill2;
                }, false);
                return () => {
                    kill1();
                    kill2();
                };
            });
            out.setVertex__(new Vertex('switchC', 0, [src]));
            return out.holdLazy(za);
        });
    }
    /**
     * Unwrap a stream inside a cell to give a time-varying stream implementation.
     */
    static switchS(csa) {
        return Transaction.execute(() => {
            const out = new StreamWithSend(), h2 = (a) => {
                out.send_(a);
            }, src = new Source(csa.getVertex__(), () => {
                let kill2 = csa
                    .sampleNoTrans__()
                    .listen_(out.getVertex__(), h2, false);
                const kill1 = csa.getStream__().listen_(out.getVertex__(), (sa) => {
                    // Connect before disconnect to avoid memory bounce, when switching to same stream twice.
                    let nextKill2 = sa.listen_(out.getVertex__(), h2, true);
                    kill2();
                    kill2 = nextKill2;
                }, false);
                return () => {
                    kill1();
                    kill2();
                };
            });
            out.setVertex__(new Vertex('switchS', 0, [src]));
            return out;
        });
    }
    /**
     * When transforming a value from a larger type to a smaller type, it is likely for duplicate changes to become
     * propergated. This function insures only distinct changes get propergated.
     */
    calm(eq) {
        return Operational.updates(this)
            .collectLazy(this.sampleLazy(), (newValue, oldValue) => {
            let result;
            if (eq(newValue, oldValue)) {
                result = null;
            }
            else {
                result = newValue;
            }
            return new Tuple2(result, newValue);
        })
            .filterNotNull().holdLazy(this.sampleLazy());
    }
    /**
     * This function is the same as calm, except you do not need to pass an eq function. This function will use (===)
     * as its eq function. I.E. calling calmRefEq() is the same as calm((a,b) => a === b).
     */
    calmRefEq() {
        return this.calm((a, b) => a === b);
    }
    /**
     * Listen for updates to the value of this cell. This is the observer pattern. The
     * returned {@link Listener} has a {@link Listener#unlisten()} method to cause the
     * listener to be removed. This is an OPERATIONAL mechanism is for interfacing between
     * the world of I/O and for FRP.
     * @param h The handler to execute when there's a new value.
     *   You should make no assumptions about what thread you are called on, and the
     *   handler should not block. You are not allowed to use {@link CellSink#send(Object)}
     *   or {@link StreamSink#send(Object)} in the handler.
     *   An exception will be thrown, because you are not meant to use this to create
     *   your own primitives.
     */
    listen(h) {
        return Transaction.execute(() => {
            return Operational.value(this).listen(h);
        });
    }
    /**
     * Fantasy-land Algebraic Data Type Compatability.
     * Cell satisfies the Functor, Apply, Applicative categories
     * @see {@link https://github.com/fantasyland/fantasy-land} for more info
     */
    //of :: Applicative f => a -> f a
    static 'fantasy-land/of'(a) {
        return new Cell(a);
    }
    //map :: Functor f => f a ~> (a -> b) -> f b
    'fantasy-land/map'(f) {
        return this.map(f);
    }
    //ap :: Apply f => f a ~> f (a -> b) -> f b
    'fantasy-land/ap'(cf) {
        return Cell.apply(cf, this);
    }
}
export class LazyCell extends Cell {
    constructor(lazyInitValue, str) {
        // @ts-expect-error: Passing null for init is safe because we
        // override sampleNoTrans__ to populate this.value with
        // realizing this.lazyInitValue which is initialized by this
        // constructor.
        super(null, null);
        Transaction.execute(() => {
            if (str)
                this.setStream(str);
            this.lazyInitValue = lazyInitValue;
        });
    }
    sampleNoTrans__() {
        // Override
        if (this.value == null && this.lazyInitValue != null) {
            this.value = this.lazyInitValue.get();
            this.lazyInitValue = null;
        }
        return this.value;
    }
}
