/**
 * Utilities for defining strongly typed configuration objects backed by
 * `LocalStorage`. The {@link Config} class exposes configuration entries as
 * properties that transparently serialize and deserialize values when accessed.
 */
import { LocalStorage } from "util/localStorage";

/** Set a default value in a LocalStorage key only if it's unset. */
export function setConfigDefault(key: string, defaultValue: string) {
    if (!LocalStorage.getItem(key)) {
        LocalStorage.setItem(key, defaultValue);
    }
}

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
            (s: string) => boolFromString(s)
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

function boolFromString(s: string): boolean {
    const lowerS = s.toLocaleLowerCase();
    return lowerS === 'true' || lowerS === 'yes' || lowerS === 'on' || lowerS === '1';
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
    private readonly _prefix: string;
    private readonly entries: Entries;
    private defaultSetters: SetDefaultFn[];

    /**
     * Create a new configuration container.
     *
     * @param prefix - String prepended to all LocalStorage keys.
     * @param entries - List of configuration name/default value pairs. Each
     *   entry generates a property on the instance.
     */
    constructor(prefix: string, entries: Entries) {
        this._prefix = prefix;
        this.entries = entries;
        this.defaultSetters = [];

        this.defineProperties();
        this.setDefaults();
    }

    get prefix(): string {
        return this._prefix;
    }

    private defineProperties() {
        for (const spec of this.entries) {
            this.registerConfig(spec);
        }
    }

    private registerConfig<N extends string, V extends ConfigValue>(spec: readonly [N, V]) {
        let localStorageKey = this._prefix + "_" + spec[0];
        let [ser, de] = getSerDeFor(spec[1]) as SerDe<any>;

        this.defaultSetters.push(() => setConfigDefault(localStorageKey, ser(spec[1])));

        /**
         * Property representing the configuration value for `spec[0]`. Getting
         * or setting this property interacts with LocalStorage.
         */
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
     * Re-apply default configuration values to LocalStorage. Only keys that do
     * not yet exist will be written.
     */
    private setDefaults() {
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
