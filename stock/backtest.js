import { ALLOC_ID, MEM_TAG_FLAGS } from "services/client/memory_tag";
import { parseAndRegisterAlloc } from "services/client/memory";
import { CONFIG } from "stock/config";
import { computeIndicators } from "stock/indicators";
/**
 * Run a backtest simulation with the given tick data.
 */
export function simulateTrades(ticks, params, initialCash) {
    const symbols = Object.keys(ticks);
    const holdings = {};
    const costBasis = {};
    const lastTrade = {};
    let cash = initialCash;
    let trades = 0;
    const timeline = [];
    const maxLen = Math.max(...symbols.map(s => ticks[s].length));
    for (let i = 0; i < maxLen; i++) {
        let tradePnl = 0;
        for (const sym of symbols) {
            const history = ticks[sym].slice(0, i + 1);
            if (history.length === 0)
                continue;
            const info = computeIndicators(history, {
                smaPeriods: [CONFIG.smaPeriod],
                emaPeriods: [CONFIG.emaPeriod],
                rocPeriods: [CONFIG.rocPeriod],
                bollingerK: CONFIG.bollingerK,
                percentiles: [params.buyPct, params.sellPct],
            });
            const now = history[history.length - 1].ts;
            if (lastTrade[sym] && now - lastTrade[sym] < params.cooldownMs) {
                continue;
            }
            const price = (history[history.length - 1].askPrice + history[history.length - 1].bidPrice) / 2;
            const buyThresh = info.percentiles[params.buyPct];
            const sellThresh = info.percentiles[params.sellPct];
            const shares = holdings[sym] ?? 0;
            if (info.zScore < -params.threshold &&
                price <= buyThresh &&
                shares < params.maxPosition) {
                const toBuy = params.maxPosition - shares;
                const cost = toBuy * price;
                if (cash >= cost) {
                    cash -= cost;
                    holdings[sym] = shares + toBuy;
                    costBasis[sym] = (costBasis[sym] ?? 0) + cost;
                    trades++;
                    lastTrade[sym] = now;
                }
            }
            else if (info.zScore > params.threshold &&
                price >= sellThresh &&
                shares > 0) {
                const proceeds = shares * price;
                cash += proceeds;
                const basis = costBasis[sym] ?? 0;
                tradePnl += proceeds - basis;
                costBasis[sym] = 0;
                holdings[sym] = 0;
                trades++;
                lastTrade[sym] = now;
            }
        }
        let value = cash;
        let ts = 0;
        for (const sym of symbols) {
            const hist = ticks[sym][Math.min(i, ticks[sym].length - 1)];
            if (!hist)
                continue;
            ts = Math.max(ts, hist.ts);
            const price = (hist.askPrice + hist.bidPrice) / 2;
            value += (holdings[sym] ?? 0) * price;
        }
        timeline.push({ ts, value, tradePnl });
    }
    for (const sym of symbols) {
        const last = ticks[sym][ticks[sym].length - 1];
        if (!last)
            continue;
        const price = (last.askPrice + last.bidPrice) / 2;
        cash += (holdings[sym] ?? 0) * price;
    }
    const result = { finalValue: cash, trades };
    return { result, timeline };
}
export async function main(ns) {
    const flags = ns.flags([
        ["cash", 1_000_000],
        ["help", false],
        ...MEM_TAG_FLAGS
    ]);
    if (flags.help) {
        ns.tprint(`USAGE: run ${ns.getScriptName()} [--cash CASH]`);
        ns.tprint("Simulate trades using historical tick data.");
        return;
    }
    const allocationId = await parseAndRegisterAlloc(ns, flags);
    if (flags[ALLOC_ID] !== -1 && allocationId === null) {
        return;
    }
    const dataPath = CONFIG.dataPath;
    const symbols = ns.stock.getSymbols();
    const ticks = {};
    for (const sym of symbols) {
        const path = `${dataPath}${sym}.json`;
        if (ns.fileExists(path)) {
            ticks[sym] = JSON.parse(ns.read(path));
        }
        else {
            ticks[sym] = [];
        }
    }
    const params = {
        threshold: 2,
        buyPct: CONFIG.buyPercentile,
        sellPct: CONFIG.sellPercentile,
        maxPosition: CONFIG.maxPosition,
        cooldownMs: CONFIG.cooldownMs,
    };
    const { result, timeline } = simulateTrades(ticks, params, Number(flags.cash));
    const backtestPnlLog = '/logs/backtest-pnl.json';
    ns.write(backtestPnlLog, JSON.stringify(timeline, null, 2), 'w');
    ns.tprint(`INFO: Backtest final value ${ns.formatNumber(result.finalValue)} with ${result.trades} trades`);
    ns.tprint(`INFO: Wrote P&L timeline to ${backtestPnlLog} with ${timeline.length} points`);
}
