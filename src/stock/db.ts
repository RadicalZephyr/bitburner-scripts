/** Utilities for persisting stock price history to IndexedDB. */

declare global {
    interface Global {
        indexedDB: any;
    }
    var globalThis: Global;
}

type IDBDatabase = any;

export interface PriceRecord {
    id?: number;
    time: number;
    symbol: string;
    price: number;
}

/**
 * Open (or create) the IndexedDB database used for storing price data.
 */
export function openPriceDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = globalThis.indexedDB.open('bitburner-stock', 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('prices')) {
                db.createObjectStore('prices', { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

/**
 * Store a snapshot of prices in the database.
 */
export function storeSnapshot(db: IDBDatabase, time: number, prices: Record<string, number>): Promise<void> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('prices', 'readwrite');
        const store = tx.objectStore('prices');
        for (const [symbol, price] of Object.entries(prices)) {
            const record: PriceRecord = { time, symbol, price };
            store.add(record);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}
