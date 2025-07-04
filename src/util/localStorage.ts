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
