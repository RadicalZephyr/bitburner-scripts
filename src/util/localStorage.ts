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
