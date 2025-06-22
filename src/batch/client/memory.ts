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

    async requestAllocation(chunkSize: number, numChunks: number): Promise<HostAllocation[]> {
        let pid = this.ns.pid;
        let returnPortId = MEMORY_PORT + pid;
        let returnPort = this.ns.getPortHandle(returnPortId);

        let payload = [returnPortId, pid, chunkSize, numChunks] as AllocationRequest;
        let request = [MessageType.Request, payload] as Message;
        while (!this.port.tryWrite(request)) {
            await this.ns.sleep(100);
        }
        await returnPort.nextWrite();
        let result = returnPort.read() as AllocationResult;

        let allocationId = result.allocationId;
        let memoryPort = this.port;
        this.ns.atExit(() => {
            memoryPort.write([
                MessageType.Release,
                [allocationId]
            ]);
        }, "memoryRelease");
        return result.hosts;
    }
}
