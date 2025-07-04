import { LocalStorage, setConfigDefault } from "./localStorage";

export type ConfigValue = string | boolean | number | bigint | object;

export type ConfigSpec<N extends string, V extends ConfigValue = ConfigValue> = [
    name: N,
    defaultValue: V
];

type SerDe<T> = [
    ser: ((v: T) => string),
    de: ((s: string) => T)
];

type SerDeFor<T extends ConfigValue> =
    T extends string ? SerDe<string> :
    T extends boolean ? SerDe<boolean> :
    T extends number ? SerDe<number> :
    T extends bigint ? SerDe<bigint> :
    SerDe<T>;

/** Return the serialize and deserialize functions for an object type. */
function getSerDeFor<T extends ConfigValue>(v: T): SerDeFor<T> {
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

export type SetDefaultFn = (() => void);

/**
 * Helper for managing configuration persisted in LocalStorage.
 *
 * The class is parameterized by a list of `[key, defaultValue]` tuples.
 * Each key is exposed as a typed getter property returning the stored value
 * parsed via `JSON.parse`. Defaults are automatically written to
 * LocalStorage on construction and can be reapplied with `setDefaults()`.
 */
export class Config<Entries extends ReadonlyArray<readonly [string, ConfigValue]>> {
    private readonly prefix: string;
    private readonly entries: Entries;
    private defaultSetters: SetDefaultFn[];

    constructor(prefix: string, entries: Entries) {
        this.prefix = prefix;
        this.entries = entries;
        this.defaultSetters = [];

        this.defineProperties();
        this.setDefaults();
    }

    private defineProperties() {
        for (const spec of this.entries) {
            this.registerConfig(spec);
        }
    }

    registerConfig<N extends string, V extends ConfigValue>(spec: readonly [N, V]) {
        let localStorageKey = this.prefix + "_" + spec[0];
        let [ser, de] = getSerDeFor(spec[1]) as SerDe<any>;

        this.defaultSetters.push(() => setConfigDefault(localStorageKey, ser(spec[1])));

        Object.defineProperty(this, spec[0], {
            get() {
                return de(LocalStorage.getItem(localStorageKey));
            },
            set(v: V) {
                LocalStorage.setItem(localStorageKey, ser(v));
            },
            enumerable: true,
        });
    }

    /**
     * Re-apply default configuration values to LocalStorage.
     */
    setDefaults() {
        for (const setDefault of this.defaultSetters) {
            setDefault();
        }
    }
}


type Widen<T> =
    T extends number ? number :
    T extends string ? string :
    T extends boolean ? boolean :
    T extends bigint ? bigint :
    T;

export type ConfigInstance<Entries extends ReadonlyArray<readonly [string, ConfigValue]>> =
    Config<Entries> & {
        [K in Entries[number][0]]: Widen<Extract<Entries[number], readonly [K, ConfigValue]>[1]>;
    };
