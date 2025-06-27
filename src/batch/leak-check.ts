import type { NS } from "netscript";

import {
    MemoryClient,
    MemorySnapshot,
    WorkerSnapshot,
    AllocationSnapshot,
} from "./client/memory";

export async function main(ns: NS) {
    ns.disableLog('ALL');
    ns.ui.openTail();

    const client = new MemoryClient(ns);
    const snapshot = await client.memorySnapshot();
    if (!snapshot) {
        ns.print("WARN: failed to retrieve memory snapshot");
        return;
    }

    checkWorkers(ns, snapshot.workers);
    checkAllocations(ns, snapshot.allocations);
    crossCheck(ns, snapshot);
    ns.print(`finished leak check.`);
}

function checkWorkers(ns: NS, workers: WorkerSnapshot[]): void {
    for (const w of workers) {
        const used = w.setAsideRam + w.reservedRam + w.allocatedRam;
        if (used > w.totalRam + 0.0001) {
            ns.print(
                `ERROR: worker ${w.hostname} uses ${ns.formatRam(used)} ` +
                `of ${ns.formatRam(w.totalRam)}`,
            );
        }
    }
}

function checkAllocations(ns: NS, allocations: AllocationSnapshot[]): void {
    for (const alloc of allocations) {
        for (const host of alloc.hosts) {
            const claims = alloc.claims
                .filter(c => c.hostname === host.hostname && c.chunkSize === host.chunkSize)
                .reduce((sum, c) => sum + c.numChunks, 0);
            if (claims > host.numChunks) {
                ns.print(
                    `ERROR: allocation ${alloc.allocationId} on ${host.hostname} ` +
                    `claims ${claims} > reserved ${host.numChunks}`,
                );
            }
        }
    }
}

function crossCheck(ns: NS, snapshot: MemorySnapshot): void {
    for (const worker of snapshot.workers) {
        const total = snapshot.allocations
            .flatMap(a => a.hosts)
            .filter(h => h.hostname === worker.hostname)
            .reduce((sum, h) => sum + h.chunkSize * h.numChunks, 0);
        if (Math.abs(total - worker.allocatedRam) > 0.001) {
            ns.print(
                `ERROR: worker ${worker.hostname} reports ${ns.formatRam(worker.allocatedRam)} ` +
                `allocated but allocations total ${ns.formatRam(total)}`,
            );
        }
    }
}
