export enum Condition {
    GreaterThan,
    LessThan,
}

function compareBy(condition: Condition): (a: number, b: number) => boolean {
    switch (condition) {
        case Condition.GreaterThan:
            return (a, b) => a > b;
        case Condition.LessThan:
            return (a, b) => a < b;
        default:
            const _exhaustiveCheck: never = condition;
            return _exhaustiveCheck;
    }
}

type PickByType<T, U> = Pick<T, {
    [K in keyof T]: T[K] extends U ? K : never
}[keyof T]>;

function pickByType<T, V>(
    obj: T,
    isV: (x: unknown) => x is V
): PickByType<T, V> {
    const result = {} as PickByType<T, V>;
    for (const key in obj) {
        const val = obj[key];
        if (isV(val)) {
            // TS knows `key` is one of the ValueFilter keys
            (result as any)[key] = val;
        }
    }
    return result;
}

type Sample<Type> = { t: number } & PickByType<Type, number>;

function sample<T>(obj: T, t?: number): Sample<T> {
    return {
        t: t ?? Date.now(),
        ...pickByType(obj, (v): v is number => typeof v === 'number')
    };
}

type ResolveFn = (value: number) => void;

interface StatListener<T> {
    stat: T;
    condition: Condition;
    threshold: number;
    resolve: ResolveFn;
}

export class StatTracker<Type> {
    historyLen: number;
    history: Sample<Type>[] = [];

    listeners: StatListener<keyof PickByType<Type, number>>[] = [];
    velocityListeners: StatListener<keyof PickByType<Type, number>>[] = [];

    constructor(historyLen?: number) {
        this.historyLen = typeof historyLen === 'number' && historyLen >= 2 ? historyLen : 3;
    }

    when(stat: keyof PickByType<Type, number>, condition: Condition, threshold: number) {
        const { promise, resolve } = Promise.withResolvers();
        this.listeners.push({ stat, condition, threshold, resolve });
        return promise;
    }

    whenVelocity(stat: keyof PickByType<Type, number>, condition: Condition, threshold: number) {
        const { promise, resolve } = Promise.withResolvers();
        this.velocityListeners.push({ stat, condition, threshold, resolve });
        return promise;

    }

    update(next: Type, t?: number) {
        const s = sample(next, t);

        this.listeners = notifyListeners(s, this.listeners);

        this.history.push(s);
        if (this.history.length > this.historyLen)
            this.history.shift();

        if (this.history.length > 2) {
            const velocity = computeVelocity(this.history.at(-1), this.history.at(0));
            this.velocityListeners = notifyListeners(velocity, this.velocityListeners);
        }
    }
}

function computeVelocity<Type>(first: Sample<Type>, last: Sample<Type>): Sample<Type> {
    const deltaT = (last.t - first.t) / 1000;
    const velocity = {} as Sample<Type>;
    for (const key in first) {
        if (key === 't') continue;

        velocity[key] = (last[key] - first[key]) / deltaT;
    }
    return velocity;
}

function notifyListeners<Type>(s: Sample<Type>, listeners: StatListener<keyof PickByType<Type, number>>[]) {
    let remaining = [];
    for (const l of listeners) {
        const stat = s[l.stat];
        const compare = compareBy(l.condition);
        if (typeof stat === "number" && compare(stat, l.threshold)) {
            l.resolve(stat);
        } else {
            remaining.push(l);
        }
    }
    return remaining;
}
