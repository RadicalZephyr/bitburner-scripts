export enum Condition {
    GreaterThan,
    LessThan,
}

export type Threshold = number | (() => number);

function compareBy(condition: Condition): (a: number, b: number) => boolean {
    switch (condition) {
        case Condition.GreaterThan: {
            return (a, b) => a > b;
        }
        case Condition.LessThan: {
            return (a, b) => a < b;
        }
        default: {
            const _exhaustiveCheck: never = condition;
            return _exhaustiveCheck;
        }
    }
}

export type PickByType<T, U> = Pick<
    T,
    {
        [K in keyof T]: T[K] extends U ? K : never;
    }[keyof T]
>;

export function pickByType<T, V>(
    obj: T,
    isV: (x: unknown) => x is V,
): PickByType<T, V> {
    const result = {} as PickByType<T, V>;
    for (const key in obj) {
        const val = obj[key];
        if (isV(val)) {
            // TS knows `key` is one of the ValueFilter keys
            (result as unknown)[key] = val;
        }
    }
    return result;
}

/**
 * A simple type alias that adds a `t` value to `PickByType<Type, number>`.
 */
export type Sample<Type> = { t: number } & PickByType<Type, number>;

function sample<T>(obj: T, t?: number): Sample<T> {
    return {
        t: t ?? Date.now(),
        ...pickByType(obj, (v): v is number => typeof v === 'number'),
    };
}

type ResolveFn = (value: number) => void;

interface StatListener<T> {
    stat: T;
    condition: Condition;
    threshold: Threshold;
    resolve: ResolveFn;
}

/**
 * A class that allows you to register for changes in a value or it's velocity.
 */
export class StatTracker<Type> {
    historyLen: number;
    history: Sample<Type>[] = [];

    listeners: StatListener<keyof PickByType<Type, number>>[] = [];
    velocityListeners: StatListener<keyof PickByType<Type, number>>[] = [];

    constructor(historyLen?: number) {
        this.historyLen =
            typeof historyLen === 'number' && historyLen >= 2 ? historyLen : 3;
    }

    /**
     * Return the most recent value of the specified field.
     *
     * @param stat - The field to retrieve the most recent value of
     * @returns Numeric value of the field, or null if no history exists yet
     */
    value(stat: keyof PickByType<Type, number>): number {
        if (this.history.length > 0) {
            return this.history.at(-1)![stat] as number;
        }
        return 1;
    }

    /**
     * Compute the velocity of the specified field.
     *
     * @param stat - The field to compute the velocity for
     * @returns Numeric value of the velocity or null if not enough history exists
     */
    velocity(stat: keyof PickByType<Type, number>): number {
        if (this.history.length > 2) {
            const velocity = computeVelocity(
                this.history.at(-1)!,
                this.history.at(0)!,
            );
            return velocity[stat] as number;
        }
        return 0;
    }

    /**
     * Watches the value of the given field, resolving when it the
     * comparing the value to the threshold satisfies the
     * condition.
     *
     * @param stat      - Which value to watch
     * @param condition - The condition to signal on
     * @param threshold - The threshold to compare the value to
     * @returns A promise that resolves when the condition is true, with the value when it became true.
     */
    when(
        stat: keyof PickByType<Type, number>,
        condition: Condition,
        threshold: Threshold,
    ) {
        const { promise, resolve } = Promise.withResolvers();
        this.listeners.push({ stat, condition, threshold, resolve });
        return promise;
    }

    /**
     * Watches the velocity of the given field, resolving when it the
     * comparing the velocity to the threshold satisfies the
     * condition.
     *
     * @param stat      - Which value to watch
     * @param condition - The condition to signal on
     * @param threshold - The threshold to compare the value to
     * @returns A promise that resolves when the condition is true, with the value when it became true.
     */
    whenVelocity(
        stat: keyof PickByType<Type, number>,
        condition: Condition,
        threshold: Threshold,
    ) {
        const { promise, resolve } = Promise.withResolvers();
        this.velocityListeners.push({ stat, condition, threshold, resolve });
        return promise;
    }

    /**
     * Add the next sample to the tracker, notifying any listeners.
     *
     * @param next - Update with the next sample
     * @param t    - Pass the timestamp for this sample, for testing purposes
     */
    update(next: Type, t?: number) {
        const s = sample(next, t);

        this.listeners = notifyListeners(s, this.listeners);

        this.history.push(s);
        if (this.history.length > this.historyLen) this.history.shift();

        if (this.history.length > 2) {
            const velocity = computeVelocity(
                this.history.at(-1),
                this.history.at(0),
            );
            this.velocityListeners = notifyListeners(
                velocity,
                this.velocityListeners,
            );
        }
    }

    /**
     * Reset the history. Useful for after an ascension so velocity
     * isn't calculated as massively negative.
     */
    reset() {
        this.history.length = 0;
    }
}

function computeVelocity<Type>(
    first: Sample<Type>,
    last: Sample<Type>,
): Sample<Type> {
    const deltaT = (last.t - first.t) / 1000;
    const velocity = {} as Sample<Type>;
    for (const key in first) {
        if (key === 't') continue;

        velocity[key] = (last[key] - first[key]) / deltaT;
    }
    return velocity;
}

function notifyListeners<Type>(
    s: Sample<Type>,
    listeners: StatListener<keyof PickByType<Type, number>>[],
) {
    const remaining = [];
    for (const l of listeners) {
        const stat = s[l.stat];
        const compare = compareBy(l.condition);
        const threshold =
            typeof l.threshold === 'function' ? l.threshold() : l.threshold;
        if (typeof stat === 'number' && compare(stat, threshold)) {
            l.resolve(stat);
        } else {
            remaining.push(l);
        }
    }
    return remaining;
}
