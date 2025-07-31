import type { NS } from 'netscript';
import { parseFlags } from 'util/flags';

import { Indicators, TrackerClient } from 'stock/client/tracker';

import { CONFIG } from 'stock/config';

/** Simple Z-Score based trading daemon. */
export async function main(ns: NS) {
    await parseFlags(ns, []);

    const client = new TrackerClient(ns);
    const symbols = ns.stock.getSymbols();
    const threshold = 2; // z-score threshold
    const lastTrade: Record<string, number> = {};

    const logPath = '/logs/trader.log';
    const maxLogSize = 100000;
    function rotateLog() {
        if (ns.fileExists(logPath)) {
            const data = ns.read(logPath) as string;
            if (data.length > maxLogSize) {
                const ts = Date.now();
                ns.write(`${logPath}.${ts}`, data, 'w');
                ns.rm(logPath);
            }
        }
    }

    function logDecision(
        action: string,
        sym: string,
        price: number,
        info: Indicators,
    ) {
        rotateLog();
        const entry = {
            ts: Date.now(),
            action,
            sym,
            price,
            z: info.zScore,
            roc: info.roc[5],
        };
        ns.write(logPath, JSON.stringify(entry) + '\n', 'a');
    }

    while (true) {
        const indicators = (await client.requestIndicators()) as Record<
            string,
            Indicators
        >;
        const maxPosition = CONFIG.maxPosition;
        const buyPct = CONFIG.buyPercentile;
        const sellPct = CONFIG.sellPercentile;
        const cooldownMs = CONFIG.cooldownMs;
        for (const sym of symbols) {
            const info = indicators[sym];
            if (!info) continue;
            const now = Date.now();
            if (lastTrade[sym] && now - lastTrade[sym] < cooldownMs) {
                continue;
            }
            const shares = ns.stock.getPosition(sym)[0];
            const price =
                (ns.stock.getAskPrice(sym) + ns.stock.getBidPrice(sym)) / 2;
            const buyThresh = info.percentiles[buyPct];
            const sellThresh = info.percentiles[sellPct];
            if (
                info.zScore < -threshold
                && price <= buyThresh
                && shares < maxPosition
            ) {
                const toBuy = Math.min(
                    maxPosition - shares,
                    ns.stock.getMaxShares(sym),
                );
                if (toBuy > 0) {
                    ns.stock.buyStock(sym, toBuy);
                    logDecision('BUY', sym, price, info);
                    lastTrade[sym] = now;
                }
            } else if (
                info.zScore > threshold
                && price >= sellThresh
                && shares > 0
            ) {
                ns.stock.sellStock(sym, shares);
                logDecision('SELL', sym, price, info);
                lastTrade[sym] = now;
            }
        }
        await ns.sleep(1000);
    }
}
