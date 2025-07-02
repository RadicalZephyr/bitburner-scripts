import type { NS } from "netscript";

import { registerAllocationOwnership } from "services/client/memory";
import { TrackerClient } from "stock/client/tracker";
import { CONFIG } from "stock/config";
import { Indicators } from "stock/indicators";

/** Simple Z-Score based trading daemon. */
export async function main(ns: NS) {
    const flags = ns.flags([["allocation-id", -1]]);

    const allocationId = flags["allocation-id"];
    if (typeof allocationId === "number" && allocationId !== -1) {
        await registerAllocationOwnership(ns, allocationId, "trader");
    }

    CONFIG.setDefaults();

    const client = new TrackerClient(ns);
    const symbols = ns.stock.getSymbols();
    const threshold = 2; // z-score threshold
    const maxPosition = CONFIG.maxPosition;

    while (true) {
        const indicators = (await client.requestIndicators()) as Record<string, Indicators>;
        for (const sym of symbols) {
            const info = indicators[sym];
            if (!info) continue;
            const shares = ns.stock.getPosition(sym)[0];
            if (info.zScore < -threshold && shares < maxPosition) {
                const toBuy = Math.min(
                    maxPosition - shares,
                    ns.stock.getMaxShares(sym),
                );
                if (toBuy > 0) ns.stock.buyStock(sym, toBuy);
            } else if (info.zScore > threshold && shares > 0) {
                ns.stock.sellStock(sym, shares);
            }
        }
        await ns.sleep(1000);
    }
}
