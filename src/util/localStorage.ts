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

export const LocalStorage = globalThis.localStorage;;

export function setConfigDefault(key: string, defaultValue: string) {
    if (!LocalStorage.getItem(key)) {
        LocalStorage.setItem(key, defaultValue);
    }
}

export type SetDefaultFn = (() => void);

export type HaveSerDe = string | boolean | number | bigint | object;

export type ConfigSpec<T extends string> = [
    name: T,
    defaultValue: HaveSerDe
];

export class Config<T extends string> {
    prefix: string;
    setDefaults: SetDefaultFn[] = [];

    constructor(prefix: string, configs: ConfigSpec<T>[]) {
        this.prefix = prefix.toUpperCase();

        for (const spec of configs) {
            this.registerConfig(spec);
        }
    }

    registerConfig(spec: ConfigSpec<T>) {
        let localStorageKey = this.prefix + "_" + spec;
        let [ser, de] = getSerDeFor(spec[1]);

        this.setDefaults.push(() => setConfigDefault(localStorageKey, ser(spec[1])));

        Object.defineProperty(this, spec[0], {
            get() {
                return de(LocalStorage.getItem(localStorageKey));
            },

            set(v: typeof spec[1]) {
                LocalStorage.setItem(localStorageKey, ser(v));
            }
        }
        );
    }
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

// Example usage:

assert("/strings", ExampleConfig.STRING);
