import type { NetscriptPort, NS } from "netscript";

import {
    MemoryClient,
    TransferableAllocation,
    MessageType,
    AllocOptions,
    GrowableAllocationRequest,
    AllocationResult,
    HostAllocation,
} from "services/client/memory";
import { PortClient } from "services/client/port";

/**
 * Allocation that can receive additional memory chunks.
 */
export class GrowableAllocation extends TransferableAllocation {
    ns: NS;
    port: NetscriptPort;

    constructor(ns: NS, allocationId: number, hosts: HostAllocation[], port: number) {
        super(allocationId, hosts);
        this.ns = ns;
        this.port = ns.getPortHandle(port);
    }
}

/** Client helper for growable allocations. */
export class GrowableMemoryClient extends MemoryClient {
    /**
     * Request a growable allocation of RAM.
     *
     * @param chunkSize - Size of each chunk in GB
     * @param numChunks - Desired number of chunks
     * @param options   - Flags that modify allocation strategy
     * @returns Growable allocation info or null on failure
     */
    async requestGrowableAllocation(
        chunkSize: number,
        numChunks: number,
        options?: AllocOptions,
    ): Promise<GrowableAllocation | null> {
        const portClient = new PortClient(this.ns);
        const port = await portClient.requestPort();
        if (typeof port !== "number") {
            this.ns.print("WARN: failed to allocate grow port");
            return null;
        }

        const contiguous = options?.contiguous ?? false;
        const coreDependent = options?.coreDependent ?? false;
        const shrinkable = options?.shrinkable ?? true;
        const longRunning = options?.longRunning ?? false;

        const payload: GrowableAllocationRequest = {
            pid: this.ns.pid,
            filename: this.ns.self().filename,
            chunkSize,
            numChunks,
            contiguous,
            coreDependent,
            shrinkable,
            longRunning,
            port,
        };

        const result = await this.sendMessageReceiveResponse(
            MessageType.GrowableRequest,
            payload,
        );
        if (!result) {
            await portClient.releasePort(port);
            this.ns.print("WARN: growable allocation request failed");
            return null;
        }
        const allocation = result as AllocationResult;
        return new GrowableAllocation(this.ns, allocation.allocationId, allocation.hosts, port);
    }
}
