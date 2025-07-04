export type ConfigValue = string | boolean | number | bigint | object;

import { LocalStorage, setConfigDefault } from "util/localStorage";

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

    constructor(prefix: string, entries: Entries) {
        this.prefix = prefix;
        this.entries = entries;
        this.defineProperties();
        this.setDefaults();
    }

    private defineProperties() {
        for (const [key] of this.entries) {
            const storageKey = `${this.prefix}_${key}`;
            Object.defineProperty(this, key, {
                get() {
                    const value = LocalStorage.getItem(storageKey);
                    return value ? JSON.parse(value) : undefined;
                },
                enumerable: true,
            });
        }
    }

    /**
     * Re-apply default configuration values to LocalStorage.
     */
    setDefaults() {
        for (const [key, value] of this.entries) {
            const storageKey = `${this.prefix}_${key}`;
            setConfigDefault(storageKey, JSON.stringify(value));
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
