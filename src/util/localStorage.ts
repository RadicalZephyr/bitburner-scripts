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

export let localStorage = globalThis.localStorage;;
