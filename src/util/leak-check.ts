import type { NS } from 'netscript';
import { MEM_TAG_FLAGS } from 'services/client/memory_tag';

import {
    MemoryClient,
    MemorySnapshot,
    WorkerSnapshot,
    AllocationSnapshot,
} from 'services/client/memory';

export async function main(ns: NS) {
    ns.flags(MEM_TAG_FLAGS);
    ns.disableLog('ALL');
    ns.ui.openTail();

    const client = new MemoryClient(ns);
    const snapshot = await client.memorySnapshot();

    if (!snapshot) {
        ns.print('WARN: failed to retrieve memory snapshot');
        return;
    }

    checkWorkers(ns, snapshot.allocations, snapshot.workers);
    checkAllocations(ns, snapshot.allocations);
    crossCheck(ns, snapshot);
    ns.print(`finished leak check.`);
}

function checkWorkers(
    ns: NS,
    allocations: AllocationSnapshot[],
    workers: WorkerSnapshot[],
): void {
    const selfDetails = ns.self();
    const selfHost = selfDetails.server;
    const selfRam = selfDetails.ramUsage;

    for (const w of workers) {
        const actualTotal = ns.getServerMaxRam(w.hostname);
        const actualInUse = ns.getServerUsedRam(w.hostname);
        const used =
            w.reservedRam
            + w.allocatedRam
            + (w.hostname === selfHost ? selfRam : 0);
        if (Math.abs(actualTotal - w.totalRam) > 0.0001) {
            ns.print(
                `ERROR: worker ${w.hostname} snapshot has incorrect total RAM `
                    + `snapshot ${ns.formatRam(w.totalRam)} actual ${ns.formatRam(actualTotal)}`,
            );
        }
        if (Math.abs(actualInUse - used) > 0.0001) {
            ns.print(
                `WARN: worker ${w.hostname} is not using all allocated RAM  `
                    + `snapshot ${ns.formatRam(used)} actual ${ns.formatRam(actualInUse)}`,
            );

            for (const alloc of allocations) {
                if (
                    ns.isRunning(alloc.pid)
                    || !alloc.hosts.find((h) => h.hostname == w.hostname)
                )
                    continue;

                const allocClaims = alloc.claims.filter(
                    (c) => c.hostname === w.hostname && !ns.isRunning(c.pid),
                );
                if (allocClaims.length > 0) {
                    const claims = allocClaims.map(
                        (c) =>
                            `\n    ${c.filename} claimed ${c.numChunks}x${ns.formatRam(c.chunkSize)}`,
                    );
                    ns.print(
                        `INFO: allocating process ${alloc.pid} running ${alloc.filename}`
                            + `\n  claims: ${claims}`,
                    );
                } else {
                    const chunkSize = alloc.hosts[0]?.chunkSize;
                    const totalChunks = alloc.hosts.reduce(
                        (sum, h) => sum + h.numChunks,
                        0,
                    );
                    ns.print(
                        `INFO: allocating process ${alloc.pid} running ${alloc.filename} `
                            + `has an unused allocation ${alloc.allocationId} of ${totalChunks}x${ns.formatRam(chunkSize)}`,
                    );
                }
            }
        }
        if (used > w.totalRam + 0.0001) {
            ns.print(
                `ERROR: worker ${w.hostname} uses ${ns.formatRam(used)} `
                    + `of ${ns.formatRam(w.totalRam)}`,
            );
        }
    }
}

function checkAllocations(ns: NS, allocations: AllocationSnapshot[]): void {
    for (const alloc of allocations) {
        const runningScript = ns.getRunningScript(alloc.pid);
        if (!runningScript && alloc.claims.length === 0) {
            const chunkSize = alloc.hosts[0]?.chunkSize;
            const hosts = alloc.hosts.map((h) => h.hostname);
            const totalChunks = alloc.hosts.reduce(
                (sum, h) => sum + h.numChunks,
                0,
            );
            ns.print(
                `ERROR: allocating process ${alloc.pid} running ${alloc.filename} on ${hosts.join(', ')} has exited and no `
                    + `other process has claimed this allocation of ${totalChunks}x${ns.formatRam(chunkSize)}`,
            );
        }

        for (const host of alloc.hosts) {
            const claimedChunks = alloc.claims
                .filter(
                    (c) =>
                        c.hostname === host.hostname
                        && c.chunkSize === host.chunkSize,
                )
                .reduce((sum, c) => sum + c.numChunks, 0);
            if (claimedChunks > host.numChunks) {
                ns.print(
                    `ERROR: allocation ${alloc.allocationId} on ${host.hostname} `
                        + `claims ${claimedChunks} > reserved ${host.numChunks}`,
                );
            }
        }
        for (const claim of alloc.claims) {
            const runningScript = ns.getRunningScript(
                claim.pid,
                claim.hostname,
            );
            if (!runningScript || runningScript.filename !== claim.filename) {
                ns.print(
                    `ERROR: exited claimaint process ${claim.pid} running `
                        + `${claim.filename} on ${claim.hostname} still has an `
                        + `active claim for ${claim.numChunks}x${ns.formatRam(claim.chunkSize)}`,
                );
            }
        }
    }
}

function crossCheck(ns: NS, snapshot: MemorySnapshot): void {
    for (const worker of snapshot.workers) {
        const total = snapshot.allocations
            .flatMap((a) => a.hosts)
            .filter((h) => h.hostname === worker.hostname)
            .reduce((sum, h) => sum + h.chunkSize * h.numChunks, 0);
        const usedRam = worker.allocatedRam;
        if (Math.abs(total - usedRam) > 0.001) {
            ns.print(
                `ERROR: worker ${worker.hostname} reports ${ns.formatRam(usedRam)} `
                    + `allocated but Allocation chunks sum to ${ns.formatRam(total)}`,
            );
        }
    }
}
