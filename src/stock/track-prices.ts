import type { NS } from "netscript";

import { openPriceDb, storeSnapshot } from "stock/db";

export async function main(ns: NS): Promise<void> {
    if (!ns.stock.hasWSEAccount() || !ns.stock.hasTIXAPIAccess()) {
        ns.tprint("ERROR: requires WSE Account and TIX API access");
        return;
    }

    const symbols = ns.stock.getSymbols();
    const db = await openPriceDb();

    while (true) {
        const prices: Record<string, number> = {};
        for (const sym of symbols) {
            prices[sym] = ns.stock.getPrice(sym);
        }

        await storeSnapshot(db, Date.now(), prices);
        await ns.stock.nextUpdate();
    }
}

