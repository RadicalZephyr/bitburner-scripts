import type { NetscriptPort, NS } from "netscript";

import { MANAGER_PORT, Message, MessageType } from "batch/client/manage";
import { MonitorClient } from "batch/client/monitor";

import { readAllFromPort } from "util/ports";
import { launch } from "batch/launch";

import { Target } from "batch/target";

export async function main(ns: NS) {
    ns.disableLog("getServerUsedRam");
    ns.disableLog("ps");
    ns.disableLog("sleep");
    ns.ui.openTail();
    ns.ui.moveTail(1010, 0);

    let targetsPort = ns.getPortHandle(MANAGER_PORT);

    let manager = new TargetSelectionManager(ns);
    let monitor = new MonitorClient(ns);

    let hostsMessagesWaiting = true;

    while (true) {
        if (hostsMessagesWaiting) {
            readHostsFromPort(ns, targetsPort, manager, monitor);
            hostsMessagesWaiting = false;

            targetsPort.nextWrite().then(_ => {
                hostsMessagesWaiting = true;
            });
        }
        await tick(ns, manager);
        await ns.sleep(100);
    }
}

function readHostsFromPort(ns: NS, hostsPort: NetscriptPort, manager: TargetSelectionManager, monitor: MonitorClient) {
    for (let nextMsg of readAllFromPort(ns, hostsPort)) {
        if (typeof nextMsg === "object") {
            let nextHostMsg = nextMsg as Message;
            let hostname = nextHostMsg[1];
            switch (nextHostMsg[0]) {
                case MessageType.NewTarget:
                    ns.print(`new target received: ${hostname}`);
                    manager.pushTarget(new Target(ns, hostname));
                    monitor.pending(hostname);
                    break;

                case MessageType.FinishedTilling:
                    ns.print(`${hostname} finished tilling`);
                    monitor.sowing(hostname);
                    break;

                case MessageType.FinishedSowing:
                    ns.print(`${hostname} finished sowing`);
                    monitor.harvesting(hostname);
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

    hackHistory: { time: number, level: number }[];
    velocity: number;

    constructor(ns: NS) {
        this.ns = ns;
        this.tillTargets = [];
        this.sowTargets = [];
        this.harvestTargets = [];
        this.pendingTargets = [];
        this.hackHistory = [];
        this.velocity = 0;
    }

    pushTarget(target: Target) {
        this.pendingTargets.push(target);
    }

    readyToTillTargets(): Target[] {
        this.updateVelocity();

        // Special bootstrap case, hack level 1 -> only n00dles
        if (this.ns.getHackingLevel() === 1) {
            const idx = this.pendingTargets.findIndex(t => t.name === "n00dles");
            if (idx >= 0) {
                return [this.pendingTargets.splice(idx, 1)[0]];
            }
            return [];
        }

        if (Math.abs(this.velocity) > 0.05) {
            // Still gaining hacking levels quickly, wait
            return [];
        }

        if (this.pendingTargets.length === 0) return [];

        // Prioritize by weaken time (faster first)
        this.pendingTargets.sort((a, b) => {
            const at = this.ns.getWeakenTime(a.name);
            const bt = this.ns.getWeakenTime(b.name);
            return at - bt;
        });

        // Pop one target to till
        return [this.pendingTargets.shift()];
    }

    tillNewTargets() {
        const toTill = this.readyToTillTargets();
        for (const target of toTill) {
            this.ns.print(`tilling ${target.name}`);
            launch(this.ns, "/batch/till.js", 1, undefined, target.name);
            this.tillTargets.push(target.name);
        }
    }

    private updateVelocity() {
        const now = Date.now();
        const lvl = this.ns.getHackingLevel();
        this.hackHistory.push({ time: now, level: lvl });
        // Keep last 5 samples
        if (this.hackHistory.length > 5) {
            this.hackHistory.shift();
        }
        if (this.hackHistory.length >= 2) {
            const first = this.hackHistory[0];
            const last = this.hackHistory[this.hackHistory.length - 1];
            const dt = (last.time - first.time) / 1000; // seconds
            const dl = last.level - first.level;
            this.velocity = dt > 0 ? dl / dt : 0;
        } else {
            this.velocity = 0;
        }
    }

}

async function tick(ns: NS, manager: TargetSelectionManager) {
    manager.tillNewTargets();
}
