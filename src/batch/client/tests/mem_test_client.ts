import type { NS } from "netscript";

import { MemoryClient } from "/batch/client/memory";

export async function main(ns: NS) {
    const client = new MemoryClient(ns);

    const allocation = await client.requestTransferableAllocation(8, 300);
    if (!allocation) {
        ns.tprintf("allocation failed");
        return;
    }

    allocation.releaseAtExit(ns, "mem-test");
    ns.tprintf("initial allocation: %s", JSON.stringify(allocation));
    await ns.sleep(3000);

    const partial = await client.releaseChunks(allocation.allocationId, 100);
    ns.tprintf("after releasing one chunk: %s", JSON.stringify(partial));
    await ns.sleep(3000);

    const final = await client.releaseChunks(allocation.allocationId, 50);
    ns.tprintf("after releasing remaining chunks: %s", JSON.stringify(final));

    const next = await client.requestTransferableAllocation(8, 300);
    if (!next) {
        ns.tprintf("second allocation failed");
        return;
    }

    ns.tprintf("new allocation: %s", JSON.stringify(next));

    for (let i = 0; i < 3; i++) {
        const delay = 1000 + Math.floor(Math.random() * 2000);
        ns.exec(
            "/batch/client/tests/test_app.js",
            ns.getHostname(),
            1,
            "--allocation-id",
            next.allocationId,
            delay,
        );
    }
}
