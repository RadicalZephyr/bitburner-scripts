import type { NS } from "netscript";
import { CONFIG } from "stock/config";
import { TickData } from "stock/indicators";
import { simulateTrades, StrategyParams } from "stock/backtest";

export async function main(ns: NS) {
    const flags = ns.flags([
        ["cash", 1_000_000],
        ["help", false],
    ]);
    if (flags.help) {
        ns.tprint(`USAGE: run ${ns.getScriptName()} [--cash CASH]`);
        ns.tprint("Sweep parameter combinations for backtesting.");
        return;
    }
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

    const buyOpts = [5, 10, 20];
    const sellOpts = [80, 90, 95];
    for (const buyPct of buyOpts) {
        for (const sellPct of sellOpts) {
            const params: StrategyParams = {
                threshold: 2,
                buyPct,
                sellPct,
                maxPosition: CONFIG.maxPosition,
                cooldownMs: CONFIG.cooldownMs,
            };
            const { result } = simulateTrades(ticks, params, Number(flags.cash));
            ns.tprint(`INFO: buy=${buyPct} sell=${sellPct} value=${ns.formatNumber(result.finalValue)}`);
        }
    }
}
