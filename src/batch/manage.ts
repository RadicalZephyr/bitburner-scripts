import type { NetscriptPort, NS, ProcessInfo } from "netscript";

import { HostMsg, WorkerType, TargetType, HOSTS_PORT, HOSTS_DONE, EMPTY_SENTINEL } from "util/ports";

import { WeakenInstance } from "batch/till";

import { Target, Worker } from "batch/types";

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

class Options {
    _maxTillTargets: number;

    constructor() {
        this._maxTillTargets = 5;
    }

    get maxTillTargets(): number {
        return this._maxTillTargets;
    }

    set setMaxTillTargets(maxTargets: number) {
        this._maxTillTargets = maxTargets;
    }
}

class State {
    ns: NS;
    options: Options;
    tillTargets: string[];
    sowTargets: string[];
    harvestTargets: string[];

    pendingTargets: Target[];

    workers: Worker[];

    constructor(ns: NS) {
        this.ns = ns;
        this.options = new Options();
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

    update() {
        this.workers.forEach(worker => worker.update());
    }

    readyToTillTargets(): Target[] {
        let hckLevel = this.ns.getHackingLevel();
        return this.pendingTargets.filter(target => hckLevel >= target.hckLevel).sort((a, b) => a.hckLevel - b.hckLevel);
    }
}

async function tick(ns: NS, state: State) {
    state.update();

    let readyToTillTargets = state.readyToTillTargets();
}
