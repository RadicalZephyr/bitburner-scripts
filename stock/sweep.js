import { parseFlags } from 'util/flags';
import { readStoredTickData } from 'stock/data';
import { simulateTrades } from 'stock/backtest';
import { CONFIG } from 'stock/config';
const FLAGS = [
    ['cash', 1_000_000],
    ['help', false],
];
export function autocomplete(data) {
    data.flags(FLAGS);
    return [];
}
export async function main(ns) {
    const flags = await parseFlags(ns, FLAGS);
    if (flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()} [--cash CASH]

Try multiple parameter combos for the stock backtester.

Example:
  > run ${ns.getScriptName()} --cash 1000000

OPTIONS
  --cash  Starting cash for the sweep
  --help  Show this help message

CONFIGURATION
  STOCK_dataPath     Directory containing tick data
  STOCK_maxPosition  Maximum shares per symbol
  STOCK_cooldownMs   Cooldown between trades
`);
        return;
    }
    const symbols = ns.stock.getSymbols();
    const ticks = {};
    for (const sym of symbols) {
        ticks[sym] = readStoredTickData(ns, sym);
    }
    const buyOpts = [5, 10, 20];
    const sellOpts = [80, 90, 95];
    for (const buyPct of buyOpts) {
        for (const sellPct of sellOpts) {
            const params = {
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
