import type { NS } from "netscript";

import { launch } from "services/launch";
import { registerAllocationOwnership } from "services/client/memory";

export async function main(ns: NS) {
    const tracker = await launch(ns, "/stock/tracker.js", {
        threads: 1,
        allocationFlag: "--allocation-id",
    });
    if (tracker) {
        await registerAllocationOwnership(ns, tracker.allocation.allocationId, "tracker-bootstrap");
    }

    const trader = await launch(ns, "/stock/trader.js", {
        threads: 1,
        allocationFlag: "--allocation-id",
    });
    if (trader) {
        await registerAllocationOwnership(ns, trader.allocation.allocationId, "trader-bootstrap");
    }
}
