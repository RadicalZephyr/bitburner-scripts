import type { NetscriptPort, NS } from "netscript";

import { HostMsg, WorkerType, TargetType, readAllFromPort, TARGETS_PORT } from "util/ports";

// import { WeakenInstance } from "batch/till";

import { Target } from "batch/target";

// import { BatchScriptInstance, spawnScriptOnWorker } from "batch/lib";

export async function main(ns: NS) {
    ns.disableLog("getServerUsedRam");
    ns.disableLog("ps");
    ns.ui.openTail();

    let targetsPort = ns.getPortHandle(TARGETS_PORT);

    let state = new State(ns);

    let hostsMessagesWaiting = true;

    while (true) {
        if (hostsMessagesWaiting) {
            readHostsFromPort(ns, targetsPort, state);
            hostsMessagesWaiting = false;

            targetsPort.nextWrite().then(_ => {
                hostsMessagesWaiting = true;
            });
        }
        await tick(ns, state);
        await ns.sleep(100);
    }
}

function readHostsFromPort(ns: NS, hostsPort: NetscriptPort, state: State) {
    for (let nextMsg of readAllFromPort(ns, hostsPort)) {
        if (typeof nextMsg === "object") {
            let nextHostMsg = nextMsg as HostMsg;
            switch (nextHostMsg.type) {
                case WorkerType:
                    // state.pushWorker(new Worker(ns, nextHostMsg.host));
                    ns.print("WARN manager script unexpectedly received a worker host message.");
                    break;
                case TargetType:
                    state.pushTarget(new Target(ns, nextHostMsg.host));
                    break;
            }
        }
    }
}

class Options {
    _maxTillTargets: number;

    constructor() {
        this._maxTillTargets = 2;
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

    constructor(ns: NS) {
        this.ns = ns;
        this.options = new Options();
        this.tillTargets = [];
        this.sowTargets = [];
        this.harvestTargets = [];
        this.pendingTargets = [];
    }

    pushTarget(target: Target) {
        this.pendingTargets.push(target);
    }

    readyToTillTargets(): Target[] {
        return [];
    }

    tillNewTargets() {
    }

}

async function tick(ns: NS, state: State) {
    state.tillNewTargets();
}
