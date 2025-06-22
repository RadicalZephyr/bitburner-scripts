import type { NS, NetscriptPort } from "netscript";

import { Worker } from "batch/worker";

import { HostMsg, HOSTS_PORT, readAllFromPort, WorkerType } from "/util/ports";

export async function main(ns: NS) {
    let hostsPort = ns.getPortHandle(HOSTS_PORT);
    let hostsMessagesWaiting = true;

    let state = new State(ns);

    while (true) {
        if (hostsMessagesWaiting) {
            readHostsFromPort(ns, hostsPort, state);
            hostsMessagesWaiting = false;

            hostsPort.nextWrite().then(_ => {
                hostsMessagesWaiting = true;
            });
        }
        await tick(ns, state);
        await ns.sleep(100);
    }
}

async function tick(ns: NS, state: State) {

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
