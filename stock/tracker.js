import { parseFlags } from 'util/flags';
import { readStoredTickData } from 'stock/data';
import { computeCorrelations, computeIndicators } from 'stock/indicators';
import { TRACKER_PORT, TRACKER_RESPONSE_PORT, MessageType, TrackerProtocol, } from 'stock/client/tracker';
import { BaseServer } from 'util/protocol';
import { CONFIG } from 'stock/config';
const FLAGS = [['help', false]];
export async function main(ns) {
    const flags = await parseFlags(ns, FLAGS);
    if (flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

Track live stock data and expose indicators via ports.

OPTIONS
  --help   Show this help message

CONFIGURATION
  STOCK_dataPath        Directory for persisting tick data
  STOCK_windowSize      Number of ticks kept in memory
  STOCK_smaPeriod       Simple moving average period
  STOCK_emaPeriod       Exponential moving average period
  STOCK_rocPeriod       Rate-of-change period
  STOCK_bollingerK      Bollinger band K value
  STOCK_buyPercentile   Buy percentile
  STOCK_sellPercentile  Sell percentile
`);
        return;
    }
    ns.disableLog('ALL');
    ns.ui.openTail();
    const symbols = ns.stock.getSymbols();
    const buffers = new Map();
    for (const sym of symbols) {
        const ticks = readStoredTickData(ns, sym);
        buffers.set(sym, ticks);
    }
    const server = new Server(ns, buffers);
    void server.readLoop();
    while (true) {
        const windowSize = CONFIG.windowSize;
        for (const sym of symbols) {
            const tick = {
                ts: Date.now(),
                askPrice: ns.stock.getAskPrice(sym),
                bidPrice: ns.stock.getBidPrice(sym),
                volatility: ns.stock.getVolatility(sym),
                forecast: ns.stock.getForecast(sym),
            };
            const buf = buffers.get(sym);
            buf.push(tick);
            if (buf.length > windowSize) {
                buf.splice(0, buf.length - windowSize);
            }
            ns.write(`${CONFIG.dataPath}${sym}.json`, JSON.stringify(buf), 'w');
        }
        const percentiles = [CONFIG.buyPercentile, CONFIG.sellPercentile];
        const stats = computeIndicators(buffers.get(symbols[0]), {
            smaPeriods: [CONFIG.smaPeriod],
            emaPeriods: [CONFIG.emaPeriod],
            rocPeriods: [CONFIG.rocPeriod],
            bollingerK: CONFIG.bollingerK,
            percentiles,
        });
        const corr = computeCorrelations(Object.fromEntries(buffers));
        ns.print(`INFO: ${symbols[0]} μ=${ns.formatNumber(stats.mean)} `
            + `median=${ns.formatNumber(stats.median)} `
            + `σ=${ns.formatNumber(stats.std)} `
            + `z=${ns.formatNumber(stats.zScore)} `);
        if (symbols.length > 1) {
            ns.print(`INFO: corr ${symbols[0]}-${symbols[1]}=`
                + ns.formatPercent(corr[symbols[0]][symbols[1]]));
        }
        await ns.stock.nextUpdate();
    }
}
class Server extends BaseServer {
    constructor(ns, buffers) {
        const requestPort = ns.getPortHandle(TRACKER_PORT);
        const responsePort = ns.getPortHandle(TRACKER_RESPONSE_PORT);
        const handlers = {
            [MessageType.RequestStockTicks]: (sym) => {
                if (buffers.has(sym))
                    return Promise.resolve(buffers.get(sym));
                else
                    throw new Error(`No stock symbol found for ${sym}`);
            },
            [MessageType.RequestAllTicks]: () => {
                return Promise.resolve(Object.fromEntries(buffers));
            },
            [MessageType.RequestIndicators]: () => {
                const res = {};
                for (const [sym, buf] of buffers.entries()) {
                    res[sym] = computeIndicators(buf, {
                        smaPeriods: [CONFIG.smaPeriod],
                        emaPeriods: [CONFIG.emaPeriod],
                        rocPeriods: [CONFIG.rocPeriod],
                        bollingerK: CONFIG.bollingerK,
                        percentiles: [
                            CONFIG.buyPercentile,
                            CONFIG.sellPercentile,
                        ],
                    });
                }
                return Promise.resolve(res);
            },
        };
        super(ns, TrackerProtocol, requestPort, responsePort, handlers);
    }
}
