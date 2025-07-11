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

function sample<T>(obj: T): Sample<T> {
    return {
        t: Date.now(),
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

    constructor(historyLen?: number) {
        this.historyLen = historyLen ?? 3;
    }

    when(stat: keyof PickByType<Type, number>, condition: Condition, threshold: number) {
        const { promise, resolve } = Promise.withResolvers();
        this.listeners.push({ stat, condition, threshold, resolve });
        return promise;
    }

    update(next: Type) {
        const stats = sample(next);
        this.history.push(stats);
        if (this.history.length > this.historyLen)
            this.history.shift();

        let remaining = [];
        for (const l of this.listeners) {
            const stat = stats[l.stat];
            const compare = compareBy(l.condition);
            if (typeof stat === "number" && compare(stat, l.threshold)) {
                l.resolve(stat);
            } else {
                remaining.push(l);
            }
        }
        this.listeners = remaining;
    }
}
