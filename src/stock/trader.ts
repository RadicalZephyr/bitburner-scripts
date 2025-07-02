import type { NS } from "netscript";

import { registerAllocationOwnership } from "services/client/memory";

export async function main(ns: NS) {
    const flags = ns.flags([
        ["allocation-id", -1],
    ]);

    const allocationId = flags["allocation-id"];
    if (typeof allocationId === "number" && allocationId !== -1) {
        await registerAllocationOwnership(ns, allocationId, "trader");
    }

    ns.print("INFO: trader daemon not implemented");
    while (true) {
        await ns.sleep(1000);
    }
}
