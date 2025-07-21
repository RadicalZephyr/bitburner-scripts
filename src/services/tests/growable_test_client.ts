import type { NS } from "netscript";
import { MEM_TAG_FLAGS } from "services/client/memory_tag";
import { GrowableMemoryClient } from "services/client/growable_memory";

export async function main(ns: NS) {
    ns.flags(MEM_TAG_FLAGS);
    const client = new GrowableMemoryClient(ns);

    const self = ns.self();
    client.registerAllocation(self.server, self.ramUsage, 1);

    const freeRam = await client.getFreeRam();
    ns.tprintf(`free ram: ${ns.formatRam(freeRam)}`);

    const chunks = Math.floor((freeRam - 16) / 8);
    const firstAlloc = await client.requestTransferableAllocation(8, chunks, { shrinkable: true });
    if (!firstAlloc) {
        ns.tprintf("first allocation failed");
        return;
    }
    ns.tprintf(`first allocation ${firstAlloc.allocationId} has ${firstAlloc.numChunks} chunks`);
    firstAlloc.releaseAtExit(ns, "growable-first");

    const growAlloc = await client.requestGrowableAllocation(8, 32);
    if (!growAlloc) {
        ns.tprintf("growable allocation failed");
        return;
    }
    ns.tprintf(`growable allocation ${growAlloc.allocationId} has ${growAlloc.numChunks} chunks`);
    growAlloc.releaseAtExit(ns, "growable-grow");

    if (growAlloc.numChunks !== 1) {
        ns.tprintf(`ERROR: expected growable allocation to start with 1 chunk, got ${growAlloc.numChunks}`);
    }

    let expectedChunks = growAlloc.numChunks;
    while (true) {
        await ns.sleep(5000);
        ns.tprintf("releasing one chunk from first allocation");
        await client.releaseChunks(firstAlloc.allocationId, 1);
        expectedChunks += 1;
        await ns.sleep(1000);
        growAlloc.pollGrowth();
        const currentChunks = growAlloc.numChunks;
        if (currentChunks !== expectedChunks) {
            ns.tprintf(`ERROR: expected ${expectedChunks} chunks, got ${currentChunks}`);
        } else {
            ns.tprintf(`growable allocation now has ${currentChunks} chunks`);
        }
    }
}
