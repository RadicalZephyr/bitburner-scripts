import type { NS, NetscriptPort } from "netscript";

import { MEMORY_PORT } from "/util/ports";

export enum MessageType {
    Request,
    Release
}

export type Message = [
    type: MessageType,
    payload: AllocationRequest | AllocationRelease,
];

// Compact version for use over ports if needed
export type AllocationRequest = [
    returnPort: number,
    lifecyclePid: number,
    chunkSize: number,
    numChunks: number,
];

export type AllocationRelease = [
    allocationId: number
];

export interface HostAllocation {
    hostname: string,
    chunkSize: number,
    numChunks: number
}

export interface AllocationResult {
    allocationId: number,
    hosts: HostAllocation[]
}

export class MemoryClient {
    ns: NS;
    port: NetscriptPort;

    constructor(ns: NS) {
        this.ns = ns;
        this.port = ns.getPortHandle(MEMORY_PORT);
    }

    /** Send a message to the memory allocator requesting a chunk of
     *  memory for the current process to own.
     *
     * This method returns the allocationId that can then be passed to
       `#.registerAllocationOwnership` to install the appropriate
       `atExit` handler for releasing the allocation when the owning
       process exits.
     */
    async requestTransferableAllocation(chunkSize: number, numChunks: number): Promise<AllocationResult> {
        let pid = this.ns.pid;
        let returnPortId = MEMORY_PORT + pid;
        let returnPort = this.ns.getPortHandle(returnPortId);

        let payload = [returnPortId, pid, chunkSize, numChunks] as AllocationRequest;
        let request = [MessageType.Request, payload] as Message;
        while (!this.port.tryWrite(request)) {
            await this.ns.sleep(100);
        }
        await returnPort.nextWrite();
        return returnPort.read() as AllocationResult;
    }

    /** Send a message to the memory allocator requesting a chunk of
     *  memory for the current process to own.
     *
     * This method also registers an `atExit` handler function to send
     * a release message to the memory allocator.
     */
    async requestOwnedAllocation(chunkSize: number, numChunks: number): Promise<HostAllocation[]> {
        let result = await this.requestTransferableAllocation(chunkSize, numChunks);
        let allocationId = result.allocationId;
        let memoryPort = this.port;
        registerAllocationOwnership(this.ns, allocationId)
        return result.hosts;
    }
}

export function registerAllocationOwnership(ns: NS, allocationId: number) {
    ns.atExit(() => {
        ns.writePort(MEMORY_PORT, [MessageType.Release, [allocationId]]);
    }, "memoryRelease");
}
