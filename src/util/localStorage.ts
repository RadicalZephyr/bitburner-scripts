declare global {
    interface Storage {
        getItem: ((keyName: string) => string),
        removeItem: ((keyName: string) => void),
        setItem: ((keyName: string, keyValue: string) => void)
    }
    interface Global {
        localStorage: Storage
    }
    var globalThis: Global;
}

let LocalStorage: Storage = globalThis.localStorage;

/**
 * Override the Storage instance used by helper functions.
 *
 * Useful for testing outside of the Bitburner environment where
 * `globalThis.localStorage` may not be defined.
 */
export function setLocalStorage(storage: Storage) {
    LocalStorage = storage;
}

export { LocalStorage };

export function setConfigDefault(key: string, defaultValue: string) {
    if (!LocalStorage.getItem(key)) {
        LocalStorage.setItem(key, defaultValue);
    }
}

export type SetDefaultFn = (() => void);

export type HaveSerDe = string | boolean | number | bigint | object;

export type ConfigSpec<N extends string, V extends HaveSerDe = HaveSerDe> = [
    name: N,
    defaultValue: V
];

export class Config<T extends string> {
    prefix: string;
    setDefaults: SetDefaultFn[] = [];

    constructor(prefix: string, configs: ConfigSpec<T>[]) {
        this.prefix = prefix.toUpperCase();

        for (const spec of configs) {
            this.registerConfig(spec);
        }

        for (const setDefault of this.setDefaults) {
            setDefault();
        }
    }

    registerConfig<N extends string, V extends HaveSerDe>(spec: ConfigSpec<N, V>) {
        let localStorageKey = this.prefix + "_" + spec[0];
        let [ser, de] = getSerDeFor(spec[1]) as SerDe<any>;

        this.setDefaults.push(() => setConfigDefault(localStorageKey, ser(spec[1])));

        Object.defineProperty(this, spec[0], {
            get() {
                return de(LocalStorage.getItem(localStorageKey));
            },

            set(v: V) {
                LocalStorage.setItem(localStorageKey, ser(v));
            }
        }
        );
    }
}

export interface Config<T extends string> {
    [key: string]: HaveSerDe;
}

type SerDe<T> = [
    ser: ((v: T) => string),
    de: ((s: string) => T)
];

type SerDeFor<T> =
    T extends string ? SerDe<string> :
    T extends boolean ? SerDe<boolean> :
    T extends number ? SerDe<number> :
    T extends bigint ? SerDe<bigint> :
    SerDe<T>;

/** Return the serialize and deserialize functions for an object type. */
function getSerDeFor<T extends HaveSerDe>(v: T): SerDeFor<T> {
    const identity = <U>(v: U) => v;

    if (typeof v === "string") {
        return [identity, identity] as SerDeFor<T>;
    } else if (typeof v === "boolean") {
        return [
            (v: T) => v.toString(),
            (s: string) => Boolean(s)
        ] as SerDeFor<T>;
    } else if (typeof v === "number") {
        return [
            (v: T) => v.toString(),
            (s: string) => Number(s),
        ] as SerDeFor<T>;
    } else if (typeof v === "bigint") {
        return [
            (v: T) => v.toString(),
            (s: string) => BigInt(s),
        ] as SerDeFor<T>;
    } else {
        return [
            (v: T) => JSON.stringify(v),
            (s: string) => JSON.parse(s) as T,
        ] as SerDeFor<T>;
    }
}
