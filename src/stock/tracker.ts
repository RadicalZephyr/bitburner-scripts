import type { NS, NetscriptPort } from "netscript";

import { CONFIG } from "stock/config";
import { computeIndicators, TickData, BasicIndicators } from "stock/indicators";
import {
    TRACKER_PORT,
    TRACKER_RESPONSE_PORT,
    Message,
    MessageType,
} from "stock/client/tracker";
import { registerAllocationOwnership } from "services/client/memory";
import { readAllFromPort, EMPTY_SENTINEL, DONE_SENTINEL } from "util/ports";

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
    const symbols = ns.stock.getSymbols();

    const buffers: Record<string, TickData[]> = {};
    for (const sym of symbols) {
        const path = `${dataPath}${sym}.json`;
        if (ns.fileExists(path)) {
            try {
                const text = ns.read(path) as string;
                buffers[sym] = JSON.parse(text);
            } catch {
                buffers[sym] = [];
            }
        } else {
            buffers[sym] = [];
        }
    }

    const port = ns.getPortHandle(TRACKER_PORT);
    const respPort = ns.getPortHandle(TRACKER_RESPONSE_PORT);
    let waiting = true;
    port.nextWrite().then(() => { waiting = true; });

    while (true) {
        if (waiting) {
            await processMessages(ns, port, respPort, buffers);
            waiting = false;
            port.nextWrite().then(() => { waiting = true; });
        }

        await ns.stock.nextUpdate();
        for (const sym of symbols) {
            const tick: TickData = {
                ts: Date.now(),
                askPrice: ns.stock.getAskPrice(sym),
                bidPrice: ns.stock.getBidPrice(sym),
                volatility: ns.stock.getVolatility(sym),
                forecast: ns.stock.getForecast(sym),
            };
            const buf = buffers[sym];
            buf.push(tick);
            if (buf.length > windowSize) {
                buf.splice(0, buf.length - windowSize);
            }
            ns.write(`${dataPath}${sym}.json`, JSON.stringify(buf), "w");
        }
        const stats = computeIndicators(buffers[symbols[0]]);
        ns.print(
            `INFO: ${symbols[0]} μ=${ns.formatNumber(stats.mean)} ` +
            `min=${ns.formatNumber(stats.min)} ` +
            `max=${ns.formatNumber(stats.max)} ` +
            `σ=${ns.formatNumber(stats.std)}`
        );
    }
}

async function processMessages(
    ns: NS,
    port: NetscriptPort,
    respPort: NetscriptPort,
    buffers: Record<string, TickData[]>
) {
    for (const next of readAllFromPort(ns, port)) {
        if (typeof next === "string") {
            if (next === EMPTY_SENTINEL || next === DONE_SENTINEL) {
                return;
            }
        }
        const msg = next as Message;
        const requestId = msg[1];
        let response: any = null;
        switch (msg[0]) {
            case MessageType.RequestTicks:
                response = buffers;
                break;
            case MessageType.RequestIndicators:
                const res: Record<string, BasicIndicators> = {};
                for (const sym of Object.keys(buffers)) {
                    res[sym] = computeIndicators(buffers[sym]);
                }
                response = res;
                break;
        }
        while (!respPort.tryWrite([requestId, response])) {
            await ns.sleep(20);
        }
    }
}
