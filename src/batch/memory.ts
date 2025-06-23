import type { NS, NetscriptPort } from "netscript";

import { AllocationRelease, AllocationRequest, Message, MessageType } from "./client/memory";

import { HostMsg, HOSTS_PORT, MEMORY_PORT, readAllFromPort, WorkerType } from "/util/ports";


export async function main(ns: NS) {
    let hostsPort = ns.getPortHandle(HOSTS_PORT);
    let hostsMessagesWaiting = true;
    let nextHostsMessage = nextMessage(hostsPort, hostsMessagesWaiting);

    let memPort = ns.getPortHandle(MEMORY_PORT);
    let memMessageWaiting = true;
    let nextMemMessage = nextMessage(memPort, memMessageWaiting);

    let state = new State(ns);

    while (true) {
        if (hostsMessagesWaiting) {
            readHostsFromPort(ns, hostsPort, state);
            nextHostsMessage = nextMessage(hostsPort, hostsMessagesWaiting);
        }
        if (memMessageWaiting) {
            readMemRequestsFromPort(ns, memPort, state);
            nextMemMessage = nextMessage(memPort, memMessageWaiting);
        }

        await Promise.any([nextHostsMessage, nextMemMessage]);
    }
}

function nextMessage(port: NetscriptPort, sentinel: boolean): Promise<void> {
    sentinel = false;
    return port.nextWrite().then(_ => { sentinel = true; });
}

function readHostsFromPort(ns: NS, hostsPort: NetscriptPort, state: State) {
    for (const nextMsg of readAllFromPort(ns, hostsPort)) {
        if (typeof nextMsg === "object") {
            let nextHostMsg = nextMsg as HostMsg;
            if (nextHostMsg.type == WorkerType) {
                state.pushWorker(nextHostMsg.host);
            }
        }
    }
}

function readMemRequestsFromPort(ns: NS, memPort: NetscriptPort, state: State) {
    for (const nextMsg of readAllFromPort(ns, memPort)) {
        let msg = nextMsg as Message;
        switch (msg[0]) {
            case MessageType.Request:
                let request = msg[1] as AllocationRequest;
                ns.printf("got mem request: %s", JSON.stringify(request));
                let returnPort = request[0];
                // TODO: actually allocate the requested memory
                ns.writePort(returnPort, {
                    allocationId: 12,
                    hosts: [],
                });
                break;
            case MessageType.Release:
                let [allocationId] = msg[1] as AllocationRelease;
                ns.printf("received release message for allocation ID: %d", allocationId);
                // TODO: actually release the allocation
                break;
        }
    }
}

class State {
    ns: NS;
    allocationId: Generator<number, void>;
    workers: Map<string, Worker>;
    allocations: Map<number, Allocation>;

    constructor(ns: NS) {
        this.ns = ns;
        this.allocationId = allocationIds();
        this.workers = new Map();
        this.allocations = new Map();
    }

    pushWorker(hostname: string) {
        this.workers.set(hostname, new Worker(this.ns, hostname));
    }
}

function* allocationIds() {
    let index = 0;

    while (true) {
        yield index++;
    }
}

class Allocation {
    id: number;
    pid: number;
    chunks: AllocationChunk[];

    constructor(id: number, pid: number, chunks: AllocationChunk[]) {
        this.id = id;
        this.pid = pid;
        this.chunks = chunks;
    }

    get totalSize(): number {
        return this.chunks.reduce((sum, c) => sum + c.totalSize, 0);
    }
}

class AllocationChunk {
    hostname: string;
    chunkSize: number;
    numChunks: number;

    constructor(hostname: string, chunkSize: number, numChunks: number) {
        this.hostname = hostname;
        this.chunkSize = chunkSize;
        this.numChunks = numChunks;
    }

    get totalSize(): number {
        return this.chunkSize * this.numChunks;
    }
}

class Worker {
    ns: NS;
    hostname: string;
    totalRam: number;
    reservedRam: number;
    allocatedRam: number;

    constructor(ns: NS, hostname: string) {
        this.ns = ns;
        this.hostname = hostname;
        this.totalRam = ns.getServerMaxRam(hostname);
        this.reservedRam = ns.getServerUsedRam(hostname);
        this.allocatedRam = 0;
    }

    get usedRam(): number {
        return this.reservedRam + this.allocatedRam;
    }

    get freeRam(): number {
        return this.totalRam - this.usedRam;
    }

    // TODO: how do we allocate less than all of the chunks
    allocate(chunkSize: number, numChunks: number): AllocationChunk {
        let ram = chunkSize * numChunks;
        if (this.freeRam >= ram) {
            this.allocatedRam += ram;
            return new AllocationChunk(this.hostname, chunkSize, numChunks);
        }
        return null;
    }

    free(ram: number): void {
        this.allocatedRam = Math.max(0, this.allocatedRam - ram);
    }
}
