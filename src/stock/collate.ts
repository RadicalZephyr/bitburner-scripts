import type { NS, AutocompleteData } from '@ns';
import { FlagsSchema, parseFlags } from 'util/flags';

import { readStoredTickData, TickData } from 'stock/data';

const FLAGS = [['help', false]] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    if (flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

Collate all stock data into tidy format for use with Plot.

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --help   Show this help message
`);
        return;
    }

    collateData(ns);
}

function collateData(ns: NS) {
    const symbols = ns.stock.getSymbols();

    const buffers = new Map<string, TickData[]>();
    for (const sym of symbols) {
        const ticks = readStoredTickData(ns, sym);
        buffers.set(sym, ticks);
    }

    const tidyStockData = Array.from(buffers.entries()).flatMap(
        ([sym, ticks]) =>
            ticks.map((d) => ({
                sym,
                mid: (d.askPrice + d.bidPrice) / 2,
                spread: d.askPrice - d.bidPrice,
                conf: Math.abs(d.forecast - 0.5) * 2,
                ...d,
            })),
    );

    ns.write('tidyStockData.json', JSON.stringify(tidyStockData), 'w');

    ns.toast('Finished tidying stock data!');
}
