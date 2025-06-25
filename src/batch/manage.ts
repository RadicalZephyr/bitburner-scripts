import type { NetscriptPort, NS } from "netscript";

import { MANAGER_PORT, Message, MessageType } from "batch/client/manage";
import { MonitorClient } from "batch/client/monitor";

import { CONFIG } from "batch/config";
import { launch } from "batch/launch";

import { readAllFromPort } from "util/ports";


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
            await readHostsFromPort(ns, targetsPort, manager, monitor);
            hostsMessagesWaiting = false;

            targetsPort.nextWrite().then(_ => {
                hostsMessagesWaiting = true;
            });
        }
        await tick(ns, manager);
        await ns.sleep(100);
    }
}

async function readHostsFromPort(ns: NS, hostsPort: NetscriptPort, manager: TargetSelectionManager, monitor: MonitorClient) {
    for (let nextMsg of readAllFromPort(ns, hostsPort)) {
        if (typeof nextMsg === "object") {
            let nextHostMsg = nextMsg as Message;
            let hostname = nextHostMsg[1];
            switch (nextHostMsg[0]) {
                case MessageType.NewTarget:
                    ns.print(`new target received: ${hostname}`);
                    monitor.pending(hostname);
                    manager.pushTarget(hostname);
                    break;

                case MessageType.FinishedTilling:
                    ns.print(`${hostname} finished tilling`);
                    monitor.sowing(hostname);
                    await manager.finishTilling(hostname);
                    break;

                case MessageType.FinishedSowing:
                    ns.print(`${hostname} finished sowing`);
                    monitor.harvesting(hostname);
                    await manager.finishSowing(hostname);
                    break;
            }
        }
    }
}

class TargetSelectionManager {
    ns: NS;
    tillTargets: Set<string>;
    sowTargets: Set<string>;
    harvestTargets: Set<string>;

    pendingTargets: string[];

    hackHistory: { time: number, level: number }[];
    velocity: number;

    constructor(ns: NS) {
        this.ns = ns;
        this.tillTargets = new Set();
        this.sowTargets = new Set();
        this.harvestTargets = new Set();
        this.pendingTargets = [];
        this.hackHistory = [];
        this.velocity = 0;
    }

    pushTarget(target: string) {
        this.pendingTargets.push(target);
    }

    readyToTillTargets(): string[] {
        // Special bootstrap case, hack level 1 -> only n00dles
        if (this.ns.getHackingLevel() === 1) {
            const idx = this.pendingTargets.findIndex(name => name === "n00dles");
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
            const at = this.ns.getWeakenTime(a);
            const bt = this.ns.getWeakenTime(b);
            return at - bt;
        });

        // Pop one target to till
        return [this.pendingTargets.shift()];
    }

    async tillNewTargets() {
        if (this.tillTargets.size >= CONFIG.maxTillTargets) return;

        const toTill = this.readyToTillTargets();
        for (const target of toTill) {
            this.ns.print(`tilling ${target}`);
            await launch(this.ns, "/batch/till.js", 1, "--allocation-id", target);
            this.tillTargets.add(target);
        }
    }

    async finishTilling(hostname: string) {
        this.tillTargets.delete(hostname);
        this.ns.print(`tilling ${hostname}`);
        await launch(this.ns, "/batch/sow.js", 1, "--allocation-id", hostname);
        this.sowTargets.add(hostname);
    }

    async finishSowing(hostname: string) {
        this.sowTargets.delete(hostname)
        this.ns.print(`harvesting ${hostname}`);
        await launch(this.ns, "/batch/harvest.js", 1, "--allocation-id", hostname);
        this.harvestTargets.add(hostname);
    }

    updateVelocity() {
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
    manager.updateVelocity();

    await manager.tillNewTargets();
}
