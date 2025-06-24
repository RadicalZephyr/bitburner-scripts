import type { NetscriptPort, NS } from "netscript";

import { MANAGER_PORT, Message, MessageType } from "batch/client/manage";

import { readAllFromPort } from "util/ports";

import { Target } from "batch/target";

// import { WeakenInstance } from "batch/till";

// import { BatchScriptInstance, spawnScriptOnWorker } from "batch/lib";

export async function main(ns: NS) {
    ns.disableLog("getServerUsedRam");
    ns.disableLog("ps");
    ns.disableLog("sleep");
    ns.ui.openTail();
    ns.ui.moveTail(1010, 0);

    let targetsPort = ns.getPortHandle(MANAGER_PORT);

    let manager = new TargetSelectionManager(ns);

    let hostsMessagesWaiting = true;

    while (true) {
        if (hostsMessagesWaiting) {
            readHostsFromPort(ns, targetsPort, manager);
            hostsMessagesWaiting = false;

            targetsPort.nextWrite().then(_ => {
                hostsMessagesWaiting = true;
            });
        }
        await tick(ns, manager);
        await ns.sleep(100);
    }
}

function readHostsFromPort(ns: NS, hostsPort: NetscriptPort, manager: TargetSelectionManager) {
    for (let nextMsg of readAllFromPort(ns, hostsPort)) {
        if (typeof nextMsg === "object") {
            let nextHostMsg = nextMsg as Message;
            let hostname = nextHostMsg[1];
            switch (nextHostMsg[0]) {
                case MessageType.NewTarget:
                    ns.print(`new target received: ${hostname}`);
                    manager.pushTarget(new Target(ns, hostname));
                    break;

                case MessageType.FinishedTilling:
                    ns.print(`${hostname} finished tilling`);
                    break;

                case MessageType.FinishedSowing:
                    ns.print(`${hostname} finished sowing`);
                    break;
            }
        }
    }
}

class TargetSelectionManager {
    ns: NS;
    tillTargets: string[];
    sowTargets: string[];
    harvestTargets: string[];

    pendingTargets: Target[];

    constructor(ns: NS) {
        this.ns = ns;
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

async function tick(ns: NS, manager: TargetSelectionManager) {
    manager.tillNewTargets();
}
