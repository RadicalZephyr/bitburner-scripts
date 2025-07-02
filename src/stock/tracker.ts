import type { NS, NetscriptPort } from "netscript";

import { CONFIG } from "stock/config";
import { computeIndicators, TickData, Indicators } from "stock/indicators";
import {
    TRACKER_PORT,
    TRACKER_RESPONSE_PORT,
    Message,
    MessageType,
} from "stock/client/tracker";
import { registerAllocationOwnership } from "services/client/memory";
import { readAllFromPort } from "util/ports";

export async function main(ns: NS) {
    const flags = ns.flags([
        ["allocation-id", -1],
    ]);

    const allocationId = flags["allocation-id"];
    if (typeof allocationId === "number" && allocationId !== -1) {
        await registerAllocationOwnership(ns, allocationId, "tracker");
    }

    CONFIG.setDefaults();
    ns.disableLog("ALL");
    ns.ui.openTail();

    const windowSize = CONFIG.windowSize;
    const dataPath = CONFIG.dataPath;
    const percentiles = [CONFIG.buyPercentile, CONFIG.sellPercentile];
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
    port.nextWrite().then(() => { waiting = true; });

    let stockUpdated = false;
    ns.stock.nextUpdate().then(() => { stockUpdated = true; });

    while (true) {
        if (waiting) {
            await processMessages(ns, port, respPort, buffers, percentiles);
            waiting = false;
            port.nextWrite().then(() => { waiting = true; });
        }

        if (stockUpdated) {
            stockUpdated = false;
            ns.stock.nextUpdate().then(() => { stockUpdated = true; });

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
                ns.write(`${dataPath}${sym}.json`, JSON.stringify(buf), "w");
            }
            const stats = computeIndicators(buffers.get(symbols[0])!, {
                smaPeriods: [5],
                emaPeriods: [5],
                rocPeriods: [5],
                percentiles,
            });
            ns.print(
                `INFO: ${symbols[0]} μ=${ns.formatNumber(stats.mean)} ` +
                `median=${ns.formatNumber(stats.median)} ` +
                `σ=${ns.formatNumber(stats.std)} ` +
                `z=${ns.formatNumber(stats.zScore)} ` +
                `roc=${ns.formatPercent(stats.roc[5])}`
            );
        }

        await ns.sleep(100);
    }
}

async function processMessages(
    ns: NS,
    port: NetscriptPort,
    respPort: NetscriptPort,
    buffers: Map<string, TickData[]>,
    percentiles: number[]
) {
    for (const next of readAllFromPort(ns, port)) {
        const msg = next as Message;
        const requestId = msg[1];
        let response: any = null;
        switch (msg[0]) {
            case MessageType.RequestTicks:
                response = Object.fromEntries(buffers);
                break;
            case MessageType.RequestIndicators:
                const res: Record<string, Indicators> = {};
                for (const [sym, buf] of buffers.entries()) {
                    res[sym] = computeIndicators(buf, {
                        smaPeriods: [5],
                        emaPeriods: [5],
                        rocPeriods: [5],
                        percentiles,
                    });
                }
                response = res;
                break;
        }
        while (!respPort.tryWrite([requestId, response])) {
            await ns.sleep(20);
        }
    }
}
