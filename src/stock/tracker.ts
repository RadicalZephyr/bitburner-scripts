import type { NS, NetscriptPort } from 'netscript';
import { ALLOC_ID, MEM_TAG_FLAGS } from 'services/client/memory_tag';

import { CONFIG } from 'stock/config';
import { computeIndicators, TickData } from 'stock/indicators';
import { computeCorrelations } from 'stock/indicators';
import {
  TRACKER_PORT,
  TRACKER_RESPONSE_PORT,
  Indicators,
  Message,
  MessageType,
} from 'stock/client/tracker';
import { parseAndRegisterAlloc } from 'services/client/memory';
import { readAllFromPort } from 'util/ports';

export async function main(ns: NS) {
  const flags = ns.flags([...MEM_TAG_FLAGS]);

  const allocationId = await parseAndRegisterAlloc(ns, flags, 'tracker');
  if (flags[ALLOC_ID] !== -1 && allocationId === null) {
    return;
  }

  ns.disableLog('ALL');
  ns.ui.openTail();

  const dataPath = CONFIG.dataPath;
  const symbols = ns.stock.getSymbols();

  const buffers = new Map<string, TickData[]>();
  for (const sym of symbols) {
    const path = `${dataPath}${sym}.json`;
    let ticks: TickData[] = [];
    if (ns.fileExists(path)) {
      try {
        const text = ns.read(path) as string;
        ticks = JSON.parse(text);
      } catch {
        ticks = [];
      }
    }
    buffers.set(sym, ticks);
  }

  const port = ns.getPortHandle(TRACKER_PORT);
  const respPort = ns.getPortHandle(TRACKER_RESPONSE_PORT);

  let waiting = true;
  let stockUpdated = true;

  while (true) {
    if (waiting) {
      waiting = false;
      port.nextWrite().then(() => {
        waiting = true;
      });
      await processMessages(ns, port, respPort, buffers);
    }

    if (stockUpdated) {
      stockUpdated = false;
      ns.stock.nextUpdate().then(() => {
        stockUpdated = true;
      });

      const windowSize = CONFIG.windowSize;
      for (const sym of symbols) {
        const tick: TickData = {
          ts: Date.now(),
          askPrice: ns.stock.getAskPrice(sym),
          bidPrice: ns.stock.getBidPrice(sym),
          volatility: ns.stock.getVolatility(sym),
          forecast: ns.stock.getForecast(sym),
        };
        const buf = buffers.get(sym)!;
        buf.push(tick);
        if (buf.length > windowSize) {
          buf.splice(0, buf.length - windowSize);
        }
        ns.write(`${dataPath}${sym}.json`, JSON.stringify(buf), 'w');
      }
      const percentiles = [CONFIG.buyPercentile, CONFIG.sellPercentile];
      const stats = computeIndicators(buffers.get(symbols[0])!, {
        smaPeriods: [CONFIG.smaPeriod],
        emaPeriods: [CONFIG.emaPeriod],
        rocPeriods: [CONFIG.rocPeriod],
        bollingerK: CONFIG.bollingerK,
        percentiles,
      });
      const corr = computeCorrelations(Object.fromEntries(buffers));
      ns.print(
        `INFO: ${symbols[0]} μ=${ns.formatNumber(stats.mean)} `
          + `median=${ns.formatNumber(stats.median)} `
          + `σ=${ns.formatNumber(stats.std)} `
          + `z=${ns.formatNumber(stats.zScore)} `
          + `roc=${ns.formatPercent(stats.roc[5])}`,
      );
      if (symbols.length > 1) {
        ns.print(
          `INFO: corr ${symbols[0]}-${symbols[1]}=`
            + ns.formatPercent(corr[symbols[0]][symbols[1]]),
        );
      }
    }

    await ns.sleep(100);
  }
}

async function processMessages(
  ns: NS,
  port: NetscriptPort,
  respPort: NetscriptPort,
  buffers: Map<string, TickData[]>,
) {
  for (const next of readAllFromPort(ns, port)) {
    const msg = next as Message;
    const requestId = msg[1];
    let response:
      | Record<string, Indicators>
      | Record<string, TickData[]>
      | void = null;
    switch (msg[0]) {
      case MessageType.RequestTicks: {
        response = Object.fromEntries(buffers);
        break;
      }
      case MessageType.RequestIndicators: {
        const res: Record<string, Indicators> = {};
        for (const [sym, buf] of buffers.entries()) {
          res[sym] = computeIndicators(buf, {
            smaPeriods: [CONFIG.smaPeriod],
            emaPeriods: [CONFIG.emaPeriod],
            rocPeriods: [CONFIG.rocPeriod],
            bollingerK: CONFIG.bollingerK,
            percentiles: [CONFIG.buyPercentile, CONFIG.sellPercentile],
          });
        }
        response = res;
        break;
      }
    }
    while (!respPort.tryWrite([requestId, response])) {
      await ns.sleep(20);
    }
  }
}
