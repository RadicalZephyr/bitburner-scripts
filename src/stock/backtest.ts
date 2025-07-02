import type { NS } from "netscript";
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

/**
 * Run a backtest simulation with the given tick data.
 */
export function simulateTrades(
    ticks: Record<string, TickData[]>,
    params: StrategyParams,
    initialCash: number
): BacktestResult {
    const symbols = Object.keys(ticks);
    const holdings: Record<string, number> = {};
    const lastTrade: Record<string, number> = {};
    let cash = initialCash;
    let trades = 0;

    const maxLen = Math.max(...symbols.map(s => ticks[s].length));
    for (let i = 0; i < maxLen; i++) {
        for (const sym of symbols) {
            const history = ticks[sym].slice(0, i + 1);
            if (history.length === 0) continue;
            const info = computeIndicators(history, {
                smaPeriods: [5],
                emaPeriods: [5],
                rocPeriods: [5],
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
                    trades++;
                    lastTrade[sym] = now;
                }
            } else if (
                info.zScore > params.threshold &&
                price >= sellThresh &&
                shares > 0
            ) {
                cash += shares * price;
                holdings[sym] = 0;
                trades++;
                lastTrade[sym] = now;
            }
        }
    }
    for (const sym of symbols) {
        const last = ticks[sym][ticks[sym].length - 1];
        if (!last) continue;
        const price = (last.askPrice + last.bidPrice) / 2;
        cash += (holdings[sym] ?? 0) * price;
    }
    return { finalValue: cash, trades };
}

export async function main(ns: NS) {
    const flags = ns.flags([["cash", 1_000_000]]);
    CONFIG.setDefaults();
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
    const result = simulateTrades(ticks, params, Number(flags.cash));
    ns.tprint(`INFO: Backtest final value ${ns.formatNumber(result.finalValue)} with ${result.trades} trades`);
}
