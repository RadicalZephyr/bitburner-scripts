import { parseFlags } from 'util/flags';
import { readStoredTickData } from 'stock/data';
const FLAGS = [['help', false]];
export function autocomplete(data) {
    data.flags(FLAGS);
    return [];
}
export async function main(ns) {
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
function collateData(ns) {
    const symbols = ns.stock.getSymbols();
    const buffers = new Map();
    for (const sym of symbols) {
        const ticks = readStoredTickData(ns, sym);
        buffers.set(sym, ticks);
    }
    const tidyStockData = Array.from(buffers.entries()).flatMap(([sym, ticks]) => ticks.map((d) => ({
        sym,
        mid: (d.askPrice + d.bidPrice) / 2,
        spread: d.askPrice - d.bidPrice,
        conf: Math.abs(d.forecast - 0.5) * 2,
        ...d,
    })));
    ns.write('tidyStockData.json', JSON.stringify(tidyStockData), 'w');
    ns.toast('Finished tidying stock data!');
}
