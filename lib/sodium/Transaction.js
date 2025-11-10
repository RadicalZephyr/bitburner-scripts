/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prefer-const */
import * as Collections from 'lib/typescript-collections';
let totalRegistrations = 0;
export function getTotalRegistrations() {
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
    constructor(origin, register_) {
        if (origin === null)
            throw new Error('null origin!');
        this.origin = origin;
        this.register_ = register_;
    }
    origin;
    register_;
    registered = false;
    deregister_ = null;
    register(target) {
        if (!this.registered) {
            this.registered = true;
            if (this.register_ != null)
                this.deregister_ = this.register_();
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
    deregister(target) {
        if (this.registered) {
            this.registered = false;
            if (this.deregister_ !== null)
                this.deregister_();
        }
    }
}
export var Color;
(function (Color) {
    Color[Color["black"] = 0] = "black";
    Color[Color["gray"] = 1] = "gray";
    Color[Color["white"] = 2] = "white";
    Color[Color["purple"] = 3] = "purple";
})(Color || (Color = {}));
let roots = [];
let nextID = 0;
let verbose = false;
export function setVerbose(v) {
    verbose = v;
}
export function describeAll(v, visited) {
    if (visited.contains(v.id))
        return;
    visited.add(v.id);
    let chs = v.children();
    for (let i = 0; i < chs.length; i++)
        describeAll(chs[i], visited);
}
export class Vertex {
    static NULL = new Vertex('user', 1e12, []);
    static collectingCycles = false;
    static toBeFreedList = [];
    id;
    constructor(name, rank, sources) {
        this.name = name;
        this.rank = rank;
        this.sources = sources;
        this.id = nextID++;
    }
    name;
    rank;
    sources;
    targets = [];
    childrn = [];
    refCount() {
        return this.targets.length;
    }
    visited = false;
    register(target) {
        return this.increment(target);
    }
    deregister(target) {
        this.decrement(target);
        Transaction._collectCyclesAtEnd();
    }
    incRefCount(target) {
        let anyChanged = false;
        if (this.refCount() == 0) {
            for (let i = 0; i < this.sources.length; i++)
                this.sources[i].register(this);
        }
        this.targets.push(target);
        target.childrn.push(this);
        if (target.ensureBiggerThan(this.rank))
            anyChanged = true;
        totalRegistrations++;
        return anyChanged;
    }
    decRefCount(target) {
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
    addSource(src) {
        this.sources.push(src);
        if (this.refCount() > 0)
            src.register(this);
    }
    ensureBiggerThan(limit) {
        if (this.visited) {
            // Undoing cycle detection for now until TimerSystem.ts ranks are checked.
            //throw new Error("Vertex cycle detected.");
            return false;
        }
        if (this.rank > limit)
            return false;
        this.visited = true;
        this.rank = limit + 1;
        for (let i = 0; i < this.targets.length; i++)
            this.targets[i].ensureBiggerThan(this.rank);
        this.visited = false;
        return true;
    }
    descr() {
        let colStr = null;
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
        let str = this.id
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
    color = Color.black;
    buffered = false;
    refCountAdj = 0;
    children() {
        return this.childrn;
    }
    increment(referrer) {
        return this.incRefCount(referrer);
    }
    decrement(referrer) {
        this.decRefCount(referrer);
        if (this.refCount() == 0)
            this.release();
        else
            this.possibleRoots();
    }
    release() {
        this.color = Color.black;
        if (!this.buffered)
            this.free();
    }
    free() {
        while (this.targets.length > 0)
            this.decRefCount(this.targets[0]);
    }
    possibleRoots() {
        if (this.color != Color.purple) {
            this.color = Color.purple;
            if (!this.buffered) {
                this.buffered = true;
                roots.push(this);
            }
        }
    }
    static collectCycles() {
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
        }
        finally {
            Vertex.collectingCycles = false;
        }
    }
    static markRoots() {
        const newRoots = [];
        // check refCountAdj was restored to zero before mark roots
        if (verbose) {
            let stack = roots.slice(0);
            let visited = new Collections.Set();
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
            }
            else {
                roots[i].buffered = false;
                if (roots[i].color == Color.black && roots[i].refCount() == 0)
                    Vertex.toBeFreedList.push(roots[i]);
            }
        }
        roots = newRoots;
    }
    static scanRoots() {
        for (let i = 0; i < roots.length; i++)
            roots[i].scan();
    }
    static collectRoots() {
        for (let i = 0; i < roots.length; i++) {
            roots[i].buffered = false;
            roots[i].collectWhite();
        }
        if (verbose) {
            // double check adjRefCount is zero for all vertices reachable by roots
            let stack = roots.slice(0);
            let visited = new Collections.Set();
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
    markGray() {
        if (this.color != Color.gray) {
            this.color = Color.gray;
            let chs = this.children();
            for (let i = 0; i < chs.length; i++) {
                chs[i].refCountAdj--;
                chs[i].markGray();
            }
        }
    }
    scan() {
        if (this.color == Color.gray) {
            if (this.refCount() + this.refCountAdj > 0)
                this.scanBlack();
            else {
                this.color = Color.white;
                let chs = this.children();
                for (let i = 0; i < chs.length; i++)
                    chs[i].scan();
            }
        }
    }
    scanBlack() {
        this.refCountAdj = 0;
        this.color = Color.black;
        let chs = this.children();
        for (let i = 0; i < chs.length; i++) {
            if (chs[i].color != Color.black)
                chs[i].scanBlack();
        }
    }
    collectWhite() {
        if (this.color == Color.white && !this.buffered) {
            this.color = Color.black;
            this.refCountAdj = 0;
            let chs = this.children();
            for (let i = 0; i < chs.length; i++)
                chs[i].collectWhite();
            Vertex.toBeFreedList.push(this);
        }
    }
}
export class Entry {
    constructor(rank, action) {
        this.rank = rank;
        this.action = action;
        this.seq = Entry.nextSeq++;
    }
    static nextSeq = 0;
    rank;
    action;
    seq;
    toString() {
        return this.seq.toString();
    }
}
export class Transaction {
    static currentTransaction = null;
    static onStartHooks = [];
    static runningOnStartHooks = false;
    constructor() { }
    inCallback = 0;
    toRegen = false;
    requestRegen() {
        this.toRegen = true;
    }
    prioritizedQ = new Collections.PriorityQueue((a, b) => {
        // Note: Low priority numbers are treated as "greater" according to this
        // comparison, so that the lowest numbers are highest priority and go first.
        if (a.rank.rank < b.rank.rank)
            return 1;
        if (a.rank.rank > b.rank.rank)
            return -1;
        if (a.seq < b.seq)
            return 1;
        if (a.seq > b.seq)
            return -1;
        return 0;
    });
    entries = new Collections.Set((a) => a.toString());
    sampleQ = [];
    lastQ = [];
    postQ = null;
    static collectCyclesAtEnd = false;
    prioritized(target, action) {
        const e = new Entry(target, action);
        this.prioritizedQ.enqueue(e);
        this.entries.add(e);
    }
    sample(h) {
        this.sampleQ.push(h);
    }
    last(h) {
        this.lastQ.push(h);
    }
    static _collectCyclesAtEnd() {
        Transaction.execute(() => (Transaction.collectCyclesAtEnd = true));
    }
    /**
     * Add an action to run after all last() actions.
     */
    post(childIx, action) {
        if (this.postQ == null)
            this.postQ = [];
        // If an entry exists already, combine the old one with the new one.
        while (this.postQ.length <= childIx)
            this.postQ.push(null);
        const existing = this.postQ[childIx], neu = existing === null
            ? action
            : () => {
                existing();
                action();
            };
        this.postQ[childIx] = neu;
    }
    // If the priority queue has entries in it when we modify any of the nodes'
    // ranks, then we need to re-generate it to make sure it's up-to-date.
    checkRegen() {
        if (this.toRegen) {
            this.toRegen = false;
            this.prioritizedQ.clear();
            const es = this.entries.toArray();
            for (let i = 0; i < es.length; i++)
                this.prioritizedQ.enqueue(es[i]);
        }
    }
    isActive() {
        return Transaction.currentTransaction ? true : false;
    }
    close() {
        while (true) {
            while (true) {
                this.checkRegen();
                if (this.prioritizedQ.isEmpty())
                    break;
                const e = this.prioritizedQ.dequeue();
                this.entries.remove(e);
                e.action();
            }
            const sq = this.sampleQ;
            this.sampleQ = [];
            for (let i = 0; i < sq.length; i++)
                sq[i]();
            if (this.prioritizedQ.isEmpty() && this.sampleQ.length < 1)
                break;
        }
        for (let i = 0; i < this.lastQ.length; i++)
            this.lastQ[i]();
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
                            }
                            catch (err) {
                                Transaction.currentTransaction.close();
                                throw err;
                            }
                        }
                        else {
                            Transaction.currentTransaction = null;
                            this.postQ[i]();
                        }
                        Transaction.currentTransaction = parent;
                    }
                    catch (err) {
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
    static onStart(r) {
        Transaction.onStartHooks.push(r);
    }
    static execute(f) {
        const transWas = Transaction.currentTransaction;
        if (transWas === null) {
            if (!Transaction.runningOnStartHooks) {
                Transaction.runningOnStartHooks = true;
                try {
                    for (let i = 0; i < Transaction.onStartHooks.length; i++)
                        Transaction.onStartHooks[i]();
                }
                finally {
                    Transaction.runningOnStartHooks = false;
                }
            }
            Transaction.currentTransaction = new Transaction();
        }
        try {
            const a = f();
            if (transWas === null) {
                Transaction.currentTransaction.close();
                Transaction.currentTransaction = null;
                if (Transaction.collectCyclesAtEnd) {
                    Vertex.collectCycles();
                    Transaction.collectCyclesAtEnd = false;
                }
            }
            return a;
        }
        catch (err) {
            if (transWas === null) {
                Transaction.currentTransaction.close();
                Transaction.currentTransaction = null;
            }
            throw err;
        }
    }
}
