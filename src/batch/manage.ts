import type { NetscriptPort, NS, ProcessInfo } from "netscript";

import { HostMsg, WorkerType, TargetType, HOSTS_PORT, HOSTS_DONE, EMPTY_SENTINEL } from "util/ports";

export async function main(ns: NS) {
    ns.tail();

    let hostsPort = ns.getPortHandle(HOSTS_PORT);

    let state = new State(ns);

    let hostsMessagesWaiting = true;

    let readHostsFromPort = makeReadHostsFromPort(ns, hostsPort, state);

    while (true) {
        if (hostsMessagesWaiting) {
            readHostsFromPort();
            hostsMessagesWaiting = false;

            hostsPort.nextWrite().then(_ => {
                hostsMessagesWaiting = true;
            });
        }
        await tick(ns, state);
        await ns.sleep(100);
    }
}

function makeReadHostsFromPort(ns: NS, hostsPort: NetscriptPort, state: State) {
    return function() {
        // Read everything from the port until empty or getting the done signal.
        while (true) {
            let nextMsg = hostsPort.read();
            if (typeof nextMsg === "string" && (nextMsg === EMPTY_SENTINEL || nextMsg === HOSTS_DONE)) {
                break;
            }

            if (typeof nextMsg === "object") {
                let nextHostMsg = nextMsg as HostMsg;
                switch (nextHostMsg.type) {
                    case WorkerType:
                        state.pushWorker(new Worker(ns, nextHostMsg.host));
                        break;
                    case TargetType:
                        state.pushTarget(new Target(ns, nextHostMsg.host));
                        break;
                }
            }
        }
    };
}

class Worker {
    ns: NS;
    name: string;
    maxRam: number;
    scripts: ProcessInfo[];

    constructor(ns: NS, host: string) {
        this.ns = ns;
        this.name = host;
        this.maxRam = ns.getServerMaxRam(host);
        this.scripts = ns.ps(host);
    }
}

class Target {
    ns: NS;
    name: string;
    maxMoney: number;
    minSec: number;

    constructor(ns: NS, host: string) {
        this.ns = ns;
        this.name = host;
        this.maxMoney = ns.getServerMaxMoney(host);
        this.minSec = ns.getServerMinSecurityLevel(host);
    }
}

async function tick(ns: NS, state: State) {

}

function tillTargets(ns: NS, targets: string[]) {

}

class State {
    ns: NS;
    tillTargets: string[];
    sowTargets: string[];
    harvestTargets: string[];

    pendingTargets: Target[];

    workers: Worker[];

    constructor(ns: NS) {
        this.ns = ns;
        this.tillTargets = [];
        this.sowTargets = [];
        this.harvestTargets = [];
        this.pendingTargets = [];
        this.workers = [];
    }

    pushTarget(target: Target) {
        this.pendingTargets.push(target);
    }

    pushWorker(worker: Worker) {
        this.workers.push(worker);
    }
}
