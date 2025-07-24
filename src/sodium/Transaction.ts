/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prefer-const */

import * as Collections from 'typescript-collections';

let totalRegistrations: number = 0;
export function getTotalRegistrations(): number {
    return totalRegistrations;
}

export class Source {
    // Note:
    // When register_ == null, a rank-independent source is constructed (a vertex which is just kept alive for the
    // lifetime of vertex that contains this source).
    // When register_ != null it is likely to be a rank-dependent source, but this will depend on the code inside register_.
    //
    // rank-independent souces DO NOT bump up the rank of the vertex containing those sources.
    // rank-depdendent sources DO bump up the rank of the vertex containing thoses sources when required.
    constructor(origin: Vertex, register_: () => () => void) {
        if (origin === null) throw new Error('null origin!');
        this.origin = origin;
        this.register_ = register_;
    }
    origin: Vertex;
    private register_: () => () => void;
    private registered: boolean = false;
    private deregister_: () => void = null;

    register(target: Vertex): void {
        if (!this.registered) {
            this.registered = true;
            if (this.register_ !== null) this.deregister_ = this.register_();
            else {
                // Note: The use of Vertex.NULL here instead of "target" is not a bug, this is done to create a
                // rank-independent source. (see note at constructor for more details.). The origin vertex still gets
                // added target vertex's children for the memory management algorithm.
                this.origin.increment(Vertex.NULL);
                target.childrn.push(this.origin);
                this.deregister_ = () => {
                    this.origin.decrement(Vertex.NULL);
                    for (let i = target.childrn.length - 1; i >= 0; --i) {
                        if (target.childrn[i] === this.origin) {
                            target.childrn.splice(i, 1);
                            break;
                        }
                    }
                };
            }
        }
    }
    deregister(target: Vertex): void {
        if (this.registered) {
            this.registered = false;
            if (this.deregister_ !== null) this.deregister_();
        }
    }
}

export enum Color {
    black,
    gray,
    white,
    purple,
}
let roots: Vertex[] = [];
let nextID: number = 0;
let verbose: boolean = false;

export function setVerbose(v: boolean): void {
    verbose = v;
}

export function describeAll(v: Vertex, visited: Collections.Set<number>) {
    if (visited.contains(v.id)) return;
    visited.add(v.id);
    let chs = v.children();
    for (let i = 0; i < chs.length; i++) describeAll(chs[i], visited);
}

export class Vertex {
    static NULL: Vertex = new Vertex('user', 1e12, []);
    static collectingCycles: boolean = false;
    static toBeFreedList: Vertex[] = [];
    id: number;

    constructor(name: string, rank: number, sources: Source[]) {
        this.name = name;
        this.rank = rank;
        this.sources = sources;
        this.id = nextID++;
    }
    name: string;
    rank: number;
    sources: Source[];
    targets: Vertex[] = [];
    childrn: Vertex[] = [];
    refCount(): number {
        return this.targets.length;
    }
    visited: boolean = false;
    register(target: Vertex): boolean {
        return this.increment(target);
    }
    deregister(target: Vertex): void {
        this.decrement(target);
        Transaction._collectCyclesAtEnd();
    }
    private incRefCount(target: Vertex): boolean {
        let anyChanged: boolean = false;
        if (this.refCount() == 0) {
            for (let i = 0; i < this.sources.length; i++)
                this.sources[i].register(this);
        }
        this.targets.push(target);
        target.childrn.push(this);
        if (target.ensureBiggerThan(this.rank)) anyChanged = true;
        totalRegistrations++;
        return anyChanged;
    }

    private decRefCount(target: Vertex): void {
        let matched = false;
        for (let i = target.childrn.length - 1; i >= 0; i--)
            if (target.childrn[i] === this) {
                target.childrn.splice(i, 1);
                break;
            }
        for (let i = 0; i < this.targets.length; i++)
            if (this.targets[i] === target) {
                this.targets.splice(i, 1);
                matched = true;
                break;
            }
        if (matched) {
            if (this.refCount() == 0) {
                for (let i = 0; i < this.sources.length; i++)
                    this.sources[i].deregister(this);
            }
            totalRegistrations--;
        }
    }

    addSource(src: Source): void {
        this.sources.push(src);
        if (this.refCount() > 0) src.register(this);
    }

    private ensureBiggerThan(limit: number): boolean {
        if (this.visited) {
            // Undoing cycle detection for now until TimerSystem.ts ranks are checked.
            //throw new Error("Vertex cycle detected.");
            return false;
        }
        if (this.rank > limit) return false;

        this.visited = true;
        this.rank = limit + 1;
        for (let i = 0; i < this.targets.length; i++)
            this.targets[i].ensureBiggerThan(this.rank);
        this.visited = false;
        return true;
    }

    descr(): string {
        let colStr: string = null;
        switch (this.color) {
            case Color.black:
                colStr = 'black';
                break;
            case Color.gray:
                colStr = 'gray';
                break;
            case Color.white:
                colStr = 'white';
                break;
            case Color.purple:
                colStr = 'purple';
                break;
        }
        let str =
            this.id
            + ' '
            + this.name
            + ' ['
            + this.refCount()
            + '/'
            + this.refCountAdj
            + '] '
            + colStr
            + ' ->';
        let chs = this.children();
        for (let i = 0; i < chs.length; i++) {
            str = str + ' ' + chs[i].id;
        }
        return str;
    }

    // --------------------------------------------------------
    // Synchronous Cycle Collection algorithm presented in "Concurrent
    // Cycle Collection in Reference Counted Systems" by David F. Bacon
    // and V.T. Rajan.

    color: Color = Color.black;
    buffered: boolean = false;
    refCountAdj: number = 0;

    children(): Vertex[] {
        return this.childrn;
    }

    increment(referrer: Vertex): boolean {
        return this.incRefCount(referrer);
    }

    decrement(referrer: Vertex): void {
        this.decRefCount(referrer);
        if (this.refCount() == 0) this.release();
        else this.possibleRoots();
    }

    release(): void {
        this.color = Color.black;
        if (!this.buffered) this.free();
    }

    free(): void {
        while (this.targets.length > 0) this.decRefCount(this.targets[0]);
    }

    possibleRoots(): void {
        if (this.color != Color.purple) {
            this.color = Color.purple;
            if (!this.buffered) {
                this.buffered = true;
                roots.push(this);
            }
        }
    }

    static collectCycles(): void {
        if (Vertex.collectingCycles) {
            return;
        }
        try {
            Vertex.collectingCycles = true;
            Vertex.markRoots();
            Vertex.scanRoots();
            Vertex.collectRoots();
            for (let i = Vertex.toBeFreedList.length - 1; i >= 0; --i) {
                let vertex = Vertex.toBeFreedList.splice(i, 1)[0];
                vertex.free();
            }
        } finally {
            Vertex.collectingCycles = false;
        }
    }

    static markRoots(): void {
        const newRoots: Vertex[] = [];
        // check refCountAdj was restored to zero before mark roots
        if (verbose) {
            let stack: Vertex[] = roots.slice(0);
            let visited: Collections.Set<number> = new Collections.Set();
            while (stack.length != 0) {
                let vertex = stack.pop();
                if (visited.contains(vertex.id)) {
                    continue;
                }
                visited.add(vertex.id);
                for (let i = 0; i < vertex.childrn.length; ++i) {
                    let child = vertex.childrn[i];
                    stack.push(child);
                }
            }
        }
        //
        for (let i = 0; i < roots.length; i++) {
            if (roots[i].color == Color.purple) {
                roots[i].markGray();
                newRoots.push(roots[i]);
            } else {
                roots[i].buffered = false;
                if (roots[i].color == Color.black && roots[i].refCount() == 0)
                    Vertex.toBeFreedList.push(roots[i]);
            }
        }
        roots = newRoots;
    }

    static scanRoots(): void {
        for (let i = 0; i < roots.length; i++) roots[i].scan();
    }

    static collectRoots(): void {
        for (let i = 0; i < roots.length; i++) {
            roots[i].buffered = false;
            roots[i].collectWhite();
        }
        if (verbose) {
            // double check adjRefCount is zero for all vertices reachable by roots
            let stack: Vertex[] = roots.slice(0);
            let visited: Collections.Set<number> = new Collections.Set();
            while (stack.length != 0) {
                let vertex = stack.pop();
                if (visited.contains(vertex.id)) {
                    continue;
                }
                visited.add(vertex.id);
                for (let i = 0; i < vertex.childrn.length; ++i) {
                    let child = vertex.childrn[i];
                    stack.push(child);
                }
            }
        }
        roots = [];
    }

    markGray(): void {
        if (this.color != Color.gray) {
            this.color = Color.gray;
            let chs = this.children();
            for (let i = 0; i < chs.length; i++) {
                chs[i].refCountAdj--;
                chs[i].markGray();
            }
        }
    }

    scan(): void {
        if (this.color == Color.gray) {
            if (this.refCount() + this.refCountAdj > 0) this.scanBlack();
            else {
                this.color = Color.white;
                let chs = this.children();
                for (let i = 0; i < chs.length; i++) chs[i].scan();
            }
        }
    }

    scanBlack(): void {
        this.refCountAdj = 0;
        this.color = Color.black;
        let chs = this.children();
        for (let i = 0; i < chs.length; i++) {
            if (chs[i].color != Color.black) chs[i].scanBlack();
        }
    }

    collectWhite(): void {
        if (this.color == Color.white && !this.buffered) {
            this.color = Color.black;
            this.refCountAdj = 0;
            let chs = this.children();
            for (let i = 0; i < chs.length; i++) chs[i].collectWhite();
            Vertex.toBeFreedList.push(this);
        }
    }
}

export class Entry {
    constructor(rank: Vertex, action: () => void) {
        this.rank = rank;
        this.action = action;
        this.seq = Entry.nextSeq++;
    }

    private static nextSeq: number = 0;
    rank: Vertex;
    action: () => void;
    seq: number;

    toString(): string {
        return this.seq.toString();
    }
}

export class Transaction {
    public static currentTransaction: Transaction = null;
    private static onStartHooks: (() => void)[] = [];
    private static runningOnStartHooks: boolean = false;

    constructor() { }

    inCallback: number = 0;
    private toRegen: boolean = false;

    requestRegen(): void {
        this.toRegen = true;
    }

    prioritizedQ: Collections.PriorityQueue<Entry> =
        new Collections.PriorityQueue<Entry>((a, b) => {
            // Note: Low priority numbers are treated as "greater" according to this
            // comparison, so that the lowest numbers are highest priority and go first.
            if (a.rank.rank < b.rank.rank) return 1;
            if (a.rank.rank > b.rank.rank) return -1;
            if (a.seq < b.seq) return 1;
            if (a.seq > b.seq) return -1;
            return 0;
        });
    private entries: Collections.Set<Entry> = new Collections.Set<Entry>((a) =>
        a.toString(),
    );
    private sampleQ: Array<() => void> = [];
    private lastQ: Array<() => void> = [];
    private postQ: Array<() => void> = null;
    private static collectCyclesAtEnd: boolean = false;

    prioritized(target: Vertex, action: () => void): void {
        const e = new Entry(target, action);
        this.prioritizedQ.enqueue(e);
        this.entries.add(e);
    }

    sample(h: () => void): void {
        this.sampleQ.push(h);
    }

    last(h: () => void): void {
        this.lastQ.push(h);
    }

    public static _collectCyclesAtEnd(): void {
        Transaction.run(() => (Transaction.collectCyclesAtEnd = true));
    }

    /**
     * Add an action to run after all last() actions.
     */
    post(childIx: number, action: () => void): void {
        if (this.postQ == null) this.postQ = [];
        // If an entry exists already, combine the old one with the new one.
        while (this.postQ.length <= childIx) this.postQ.push(null);
        const existing = this.postQ[childIx],
            neu =
                existing === null
                    ? action
                    : () => {
                        existing();
                        action();
                    };
        this.postQ[childIx] = neu;
    }

    // If the priority queue has entries in it when we modify any of the nodes'
    // ranks, then we need to re-generate it to make sure it's up-to-date.
    private checkRegen(): void {
        if (this.toRegen) {
            this.toRegen = false;
            this.prioritizedQ.clear();
            const es = this.entries.toArray();
            for (let i: number = 0; i < es.length; i++)
                this.prioritizedQ.enqueue(es[i]);
        }
    }

    public isActive(): boolean {
        return Transaction.currentTransaction ? true : false;
    }

    close(): void {
        while (true) {
            while (true) {
                this.checkRegen();
                if (this.prioritizedQ.isEmpty()) break;
                const e = this.prioritizedQ.dequeue();
                this.entries.remove(e);
                e.action();
            }

            const sq = this.sampleQ;
            this.sampleQ = [];
            for (let i = 0; i < sq.length; i++) sq[i]();

            if (this.prioritizedQ.isEmpty() && this.sampleQ.length < 1) break;
        }

        for (let i = 0; i < this.lastQ.length; i++) this.lastQ[i]();
        this.lastQ = [];
        if (this.postQ != null) {
            for (let i = 0; i < this.postQ.length; i++) {
                if (this.postQ[i] != null) {
                    const parent = Transaction.currentTransaction;
                    try {
                        if (i > 0) {
                            Transaction.currentTransaction = new Transaction();
                            try {
                                this.postQ[i]();
                                Transaction.currentTransaction.close();
                            } catch (err) {
                                Transaction.currentTransaction.close();
                                throw err;
                            }
                        } else {
                            Transaction.currentTransaction = null;
                            this.postQ[i]();
                        }
                        Transaction.currentTransaction = parent;
                    } catch (err) {
                        Transaction.currentTransaction = parent;
                        throw err;
                    }
                }
            }
            this.postQ = null;
        }
    }

    /**
     * Add a runnable that will be executed whenever a transaction is started.
     * That runnable may start transactions itself, which will not cause the
     * hooks to be run recursively.
     *
     * The main use case of this is the implementation of a time/alarm system.
     */
    static onStart(r: () => void): void {
        Transaction.onStartHooks.push(r);
    }

    public static run<A>(f: () => A): A {
        const transWas: Transaction = Transaction.currentTransaction;
        if (transWas === null) {
            if (!Transaction.runningOnStartHooks) {
                Transaction.runningOnStartHooks = true;
                try {
                    for (let i = 0; i < Transaction.onStartHooks.length; i++)
                        Transaction.onStartHooks[i]();
                } finally {
                    Transaction.runningOnStartHooks = false;
                }
            }
            Transaction.currentTransaction = new Transaction();
        }
        try {
            const a: A = f();
            if (transWas === null) {
                Transaction.currentTransaction.close();
                Transaction.currentTransaction = null;
                if (Transaction.collectCyclesAtEnd) {
                    Vertex.collectCycles();
                    Transaction.collectCyclesAtEnd = false;
                }
            }
            return a;
        } catch (err) {
            if (transWas === null) {
                Transaction.currentTransaction.close();
                Transaction.currentTransaction = null;
            }
            throw err;
        }
    }
}
