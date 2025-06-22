import type { NS, NetscriptPort } from "netscript";

import { Worker } from "batch/worker";

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
        await ns.sleep(100);
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
