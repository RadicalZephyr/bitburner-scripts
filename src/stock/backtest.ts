import type { NS } from "netscript";
import { ALLOC_ID, MEM_TAG_FLAGS, TAG_ARG } from "services/client/memory_tag";
import { parseAndRegisterAlloc } from "services/client/memory";
import { CONFIG } from "stock/config";
import { computeIndicators, TickData } from "stock/indicators";

/** Parameters controlling the trading strategy for a simulation. */
export interface StrategyParams {
    threshold: number;
    buyPct: number;
    sellPct: number;
    maxPosition: number;
    cooldownMs: number;
}

/** Summary of a simulated run. */
export interface BacktestResult {
    finalValue: number;
    trades: number;
}

/** Record of portfolio value and realized P&L for a single tick. */
export interface PnlRecord {
    ts: number;
    value: number;
    tradePnl: number;
}

/**
 * Run a backtest simulation with the given tick data.
 */
export function simulateTrades(
    ticks: Record<string, TickData[]>,
    params: StrategyParams,
    initialCash: number
): { result: BacktestResult; timeline: PnlRecord[] } {
    const symbols = Object.keys(ticks);
    const holdings: Record<string, number> = {};
    const costBasis: Record<string, number> = {};
    const lastTrade: Record<string, number> = {};
    let cash = initialCash;
    let trades = 0;
    const timeline: PnlRecord[] = [];

    const maxLen = Math.max(...symbols.map(s => ticks[s].length));
    for (let i = 0; i < maxLen; i++) {
        let tradePnl = 0;
        for (const sym of symbols) {
            const history = ticks[sym].slice(0, i + 1);
            if (history.length === 0) continue;
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
            if (
                info.zScore < -params.threshold &&
                price <= buyThresh &&
                shares < params.maxPosition
            ) {
                const toBuy = params.maxPosition - shares;
                const cost = toBuy * price;
                if (cash >= cost) {
                    cash -= cost;
                    holdings[sym] = shares + toBuy;
                    costBasis[sym] = (costBasis[sym] ?? 0) + cost;
                    trades++;
                    lastTrade[sym] = now;
                }
            } else if (
                info.zScore > params.threshold &&
                price >= sellThresh &&
                shares > 0
            ) {
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
            if (!hist) continue;
            ts = Math.max(ts, hist.ts);
            const price = (hist.askPrice + hist.bidPrice) / 2;
            value += (holdings[sym] ?? 0) * price;
        }
        timeline.push({ ts, value, tradePnl });
    }
    for (const sym of symbols) {
        const last = ticks[sym][ticks[sym].length - 1];
        if (!last) continue;
        const price = (last.askPrice + last.bidPrice) / 2;
        cash += (holdings[sym] ?? 0) * price;
    }
    const result: BacktestResult = { finalValue: cash, trades };
    return { result, timeline };
}

export async function main(ns: NS) {
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
    const ticks: Record<string, TickData[]> = {};
    for (const sym of symbols) {
        const path = `${dataPath}${sym}.json`;
        if (ns.fileExists(path)) {
            ticks[sym] = JSON.parse(ns.read(path) as string);
        } else {
            ticks[sym] = [];
        }
    }

    const params: StrategyParams = {
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
