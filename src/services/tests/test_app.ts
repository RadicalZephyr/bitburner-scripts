import type { NS } from "netscript";

import { registerAllocationOwnership } from "services/client/memory";

export async function main(ns: NS) {
    const flags = ns.flags([
        ["allocation-id", 0],
        ["help", false],
    ]);
    const rest = flags._ as (string | number)[];
    if (
        flags.help ||
        typeof flags["allocation-id"] !== "number" ||
        rest.length === 0 ||
        typeof rest[0] !== "number"
    ) {
        ns.tprint(
            `Usage: run ${ns.getScriptName()} --allocation-id ID TIME_MS`
        );
        return;
    }

    const allocationId = flags["allocation-id"] as number;
    await registerAllocationOwnership(ns, allocationId);

    const sleepTime = rest[0] as number;
    await ns.sleep(sleepTime);
}
