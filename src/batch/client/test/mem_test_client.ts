import type { NS } from "netscript";

import { MemoryClient } from "/batch/client/memory";

export async function main(ns: NS) {
    const client = new MemoryClient(ns);

    const allocation = await client.requestTransferableAllocation(1, 3);
    if (!allocation) {
        ns.tprintf("allocation failed");
        return;
    }

    allocation.releaseAtExit(ns, "mem-test");
    ns.tprintf("initial allocation: %s", JSON.stringify(allocation));
    await ns.sleep(3000);

    const partial = await client.releaseChunks(allocation.allocationId, 1);
    ns.tprintf("after releasing one chunk: %s", JSON.stringify(partial));
    await ns.sleep(3000);

    const final = await client.releaseChunks(allocation.allocationId, 2);
    ns.tprintf("after releasing remaining chunks: %s", JSON.stringify(final));
}
