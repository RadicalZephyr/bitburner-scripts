import type { NS, NetscriptPort } from "netscript";

import { Worker } from "batch/worker";

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
    workers: Worker[];

    constructor(ns: NS) {
        this.ns = ns;
        this.workers = [];
    }

    pushWorker(hostname: string) {
        this.workers.push(new Worker(this.ns, hostname));
    }
}
