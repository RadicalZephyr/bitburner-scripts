import { Vertex, Source } from "sodium/Vertex";
import * as Collections from 'typescript-collections';
import { Stream, StreamWithSend } from "sodium/Stream";
import { StreamSink } from "sodium/StreamSink";
import { Cell } from "sodium/Cell";
import { CellSink } from "sodium/CellSink";
import { Transaction } from "sodium/Transaction";

/**
 * An interface for implementations of FRP timer systems.
 */
export abstract class TimerSystemImpl {
    /**
     * Set a timer that will execute the specified callback at the specified time.
     * @return A function that can be used to cancel the timer.
     */
    abstract setTimer(t: number, callback: () => void): () => void;

    /**
     * Return the current clock time.
     */
    abstract now(): number;
}

let nextSeq: number = 0;

class Event {
    constructor(t: number, sAlarm: StreamWithSend<number>) {
        this.t = t;
        this.sAlarm = sAlarm;
        this.seq = ++nextSeq;
    }
    t: number;
    sAlarm: StreamWithSend<number>;
    seq: number;  // Used to guarantee uniqueness
}

export class TimerSystem {
    constructor(impl: TimerSystemImpl) {
        Transaction.run(() => {
            this.impl = impl;
            this.tMinimum = 0;
            const timeSnk = new CellSink<number>(impl.now());
            this.time = timeSnk;
            // A dummy listener to time to keep it alive even when there are no other listeners.
            this.time.listen((t: number) => { });
            Transaction.onStart(() => {
                // Ensure the time is always increasing from the FRP's point of view.
                const t = this.tMinimum = Math.max(this.tMinimum, impl.now());
                // Pop and execute all events earlier than or equal to t (the current time).
                while (true) {
                    let ev: Event = null;
                    if (!this.eventQueue.isEmpty()) {
                        let mev = this.eventQueue.minimum();
                        if (mev.t <= t) {
                            ev = mev;
                            // TO DO: Detect infinite loops!
                        }
                    }
                    if (ev != null) {
                        timeSnk.send(ev.t);
                        Transaction.run(() => ev.sAlarm.send_(ev.t));
                    }
                    else
                        break;
                }
                timeSnk.send(t);
            });
        });
    }

    private impl: TimerSystemImpl;
    private tMinimum: number;  // A guard to allow us to guarantee that the time as
    // seen by the FRP is always increasing.

    /**
     * A cell giving the current clock time.
     */
    time: Cell<number>;

    private eventQueue: Collections.BSTree<Event> = new Collections.BSTree<Event>((a, b) => {
        if (a.t < b.t) return -1;
        if (a.t > b.t) return 1;
        if (a.seq < b.seq) return -1;
        if (a.seq > b.seq) return 1;
        return 0;
    });

    /**
     * A timer that fires at the specified time, which can be null, meaning
     * that the alarm is not set.
     */
    at(tAlarm: Cell<number>): Stream<number> {
        let current: Event = null,
            cancelCurrent: () => void = null,
            active: boolean = false,
            tAl: number = null,
            sampled: boolean = false;
        const sAlarm = new StreamWithSend<number>(null),
            updateTimer = () => {
                if (cancelCurrent !== null) {
                    cancelCurrent();
                    this.eventQueue.remove(current);
                }
                cancelCurrent = null;
                current = null;
                if (active) {
                    if (!sampled) {
                        sampled = true;
                        tAl = tAlarm.sampleNoTrans__();
                    }
                    if (tAl !== null) {
                        current = new Event(tAl, sAlarm);
                        this.eventQueue.add(current);
                        cancelCurrent = this.impl.setTimer(tAl, () => {
                            // Correction to ensure the clock time appears to be >= the
                            // alarm time. It can be a few milliseconds early, and
                            // this breaks things otherwise, because it doesn't think
                            // it's time to fire the alarm yet.
                            this.tMinimum = Math.max(this.tMinimum, tAl);
                            // Open and close a transaction to trigger queued
                            // events to run.
                            Transaction.run(() => { });
                        });
                    }
                }
            };
        sAlarm.setVertex__(new Vertex("at", 0, [
            new Source(
                tAlarm.getVertex__(),
                () => {
                    active = true;
                    sampled = false;
                    Transaction.currentTransaction.prioritized(sAlarm.getVertex__(), updateTimer);
                    const kill = tAlarm.getStream__().listen_(sAlarm.getVertex__(), (oAlarm: number) => {
                        tAl = oAlarm;
                        sampled = true;
                        updateTimer();
                    }, false);
                    return () => {
                        active = false;
                        updateTimer();
                        kill();
                    };
                }
            )
        ]
        ));
        return sAlarm;
    }
}
