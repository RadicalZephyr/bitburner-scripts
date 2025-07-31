import type { AutocompleteData, NS } from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

import { CONFIG } from 'stock/config';
import { TickData } from 'stock/indicators';
import { simulateTrades, StrategyParams } from 'stock/backtest';

const FLAGS = [
    ['cash', 1_000_000],
    ['help', false],
] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

export async function main(ns: NS) {
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
            const { result } = simulateTrades(
                ticks,
                params,
                Number(flags.cash),
            );
            ns.tprint(
                `INFO: buy=${buyPct} sell=${sellPct} value=${ns.formatNumber(result.finalValue)}`,
            );
        }
    }
}
