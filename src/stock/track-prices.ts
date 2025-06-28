import type { NS } from "netscript";

import { LocalStorage } from "util/localStorage";

const STORAGE_KEY = "STOCK_PRICE_HISTORY";

interface StockSnapshot {
    time: number;
    prices: Record<string, number>;
}

function loadHistory(): StockSnapshot[] {
    const raw = LocalStorage.getItem(STORAGE_KEY);
    if (!raw) {
        return [];
    }
    try {
        return JSON.parse(raw) as StockSnapshot[];
    } catch (_err) {
        return [];
    }
}

function saveHistory(history: StockSnapshot[]): void {
    LocalStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export async function main(ns: NS): Promise<void> {
    if (!ns.stock.hasWSEAccount() || !ns.stock.hasTIXAPIAccess()) {
        ns.tprint("ERROR: requires WSE Account and TIX API access");
        return;
    }

    const symbols = ns.stock.getSymbols();
    const history = loadHistory();

    while (true) {
        const snapshot: StockSnapshot = {
            time: Date.now(),
            prices: {},
        };

        for (const sym of symbols) {
            snapshot.prices[sym] = ns.stock.getPrice(sym);
        }

        history.push(snapshot);
        saveHistory(history);

        await ns.stock.nextUpdate();
    }
}

