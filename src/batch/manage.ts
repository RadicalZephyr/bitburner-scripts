import type { NetscriptPort, NS } from "netscript";

import { MANAGER_PORT, Message, MessageType } from "batch/client/manage";
import { registerAllocationOwnership } from "./client/memory";
import { MonitorClient } from "batch/client/monitor";

import { CONFIG } from "batch/config";
import { expectedValuePerRamSecond } from "batch/expected_value";
import { launch } from "batch/launch";

import { readAllFromPort } from "util/ports";

import PriorityQueue from "typescript-collections/PriorityQueue";

let compareExpectedValue: (ta: string, tb: string) => number;

export async function main(ns: NS) {
    const flags = ns.flags([
        ['allocation-id', -1],
    ]);

    let allocationId = flags['allocation-id'];
    if (allocationId !== -1) {
        if (typeof allocationId !== 'number') {
            ns.tprint('--allocation-id must be a number');
            return;
        }
        registerAllocationOwnership(ns, allocationId, "self");
    }

    compareExpectedValue = (ta, tb) => {
        return expectedValuePerRamSecond(ns, ta, CONFIG.batchInterval)
            - expectedValuePerRamSecond(ns, tb, CONFIG.batchInterval);
    };

    ns.disableLog("ALL");
    ns.ui.openTail();
    ns.ui.moveTail(730, 0);
    ns.print(`INFO: starting manager on ${ns.getHostname()}`);

    let targetsPort = ns.getPortHandle(MANAGER_PORT);

    let monitor = new MonitorClient(ns);
    let manager = new TargetSelectionManager(ns, monitor);

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
                    ns.print(`INFO: received target ${hostname}`);
                    await monitor.pending(hostname);
                    manager.pushTarget(hostname);
                    break;

                case MessageType.FinishedTilling:
                    ns.print(`SUCCESS: finished tilling ${hostname}`);
                    await monitor.sowing(hostname);
                    await manager.finishTilling(hostname);
                    break;

                case MessageType.FinishedSowing:
                    ns.print(`SUCCESS: finished sowing ${hostname}`);
                    // TODO: this should be moved into `finishSowing`
                    await monitor.harvesting(hostname);
                    await manager.finishSowing(hostname);
                    break;
            }
        }
    }
}

class TargetSelectionManager {
    ns: NS;
    monitor: MonitorClient;

    allTargets: Set<string>;

    tillTargets: Set<string>;
    sowTargets: Set<string>;

    harvestTargets: Set<string>;

    pendingTargets: string[];
    pendingHarvestTargets: string[];

    hackHistory: { time: number, level: number }[];
    velocity: number;

    constructor(ns: NS, monitor: MonitorClient) {
        this.ns = ns;
        this.monitor = monitor;

        this.allTargets = new Set();

        this.pendingTargets = [];
        this.pendingHarvestTargets = [];

        this.tillTargets = new Set();
        this.sowTargets = new Set();
        this.harvestTargets = new Set();

        this.hackHistory = [];
        this.velocity = 0;
    }

    pushTarget(target: string) {
        if (this.allTargets.has(target)) return;

        this.allTargets.add(target);
        this.pendingTargets.push(target);
        this.ns.print(`INFO: queued target ${target}`);
    }

    readyToTillTargets(): string[] {
        // Special bootstrap case, hack level 1 -> only n00dles
        if (this.ns.getHackingLevel() === 1) {
            // TODO: this seems bad, but it's hard to get
            return ["n00dles"];
        }

        if (Math.abs(this.velocity) > 0.05) {
            // Still gaining hacking levels quickly, wait
            return [];
        }

        if (this.pendingTargets.length === 0) return [];

        // Sort by expected value
        this.pendingTargets.sort(compareExpectedValue);

        // Pop one target to till
        const next = this.pendingTargets.shift();
        if (next) {
            this.ns.print(`INFO: selecting ${next} for tilling`);
            return [next];
        }
        return [];
    }

    async tillNewTargets() {
        if (this.tillTargets.size >= CONFIG.maxTillTargets) {
            this.ns.print(`WARN: till target limit ${CONFIG.maxTillTargets} reached`);
            return;
        }

        const toTill = this.readyToTillTargets();
        for (const target of toTill) {
            this.ns.print(`INFO: launching till on ${target}`);
            await launch(this.ns, "/batch/till.js", { threads: 1, allocationFlag: "--allocation-id" }, target);
            this.tillTargets.add(target);
            await this.monitor.tilling(target);
        }
    }

    async finishTilling(hostname: string) {
        this.tillTargets.delete(hostname);
        this.ns.print(`INFO: launching sow on ${hostname}`);
        await launch(this.ns, "/batch/sow.js", { threads: 1, allocationFlag: "--allocation-id" }, hostname);
        this.sowTargets.add(hostname);
    }

    async finishSowing(hostname: string) {
        this.sowTargets.delete(hostname);
        if (noodlesIsSpecial(this.ns, hostname) ||
            (canHarvest(this.ns, hostname) && worthHarvesting(this.ns, hostname))) {
            this.ns.print(`INFO: launching harvest on ${hostname}`);
            await launch(this.ns, "/batch/harvest.js", { threads: 1, allocationFlag: "--allocation-id" }, hostname);
            this.harvestTargets.add(hostname);
        } else {
            this.ns.print(`INFO: waiting to harvest ${hostname}`);
            this.pendingHarvestTargets.push(hostname);
        }
    }

    async harvestNewTargets() {
        this.pendingHarvestTargets.sort(compareExpectedValue);

        let nextTarget = this.pendingHarvestTargets[0];
        if (nextTarget && canHarvest(this.ns, nextTarget) && worthHarvesting(this.ns, nextTarget)) {
            this.pendingHarvestTargets.shift();
            this.ns.print(`INFO: launching harvest on ${nextTarget}`);
            await launch(this.ns, "/batch/harvest.js", { threads: 1, allocationFlag: "--allocation-id" }, nextTarget);
            this.harvestTargets.add(nextTarget);
        }
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
    await manager.harvestNewTargets();
}

function noodlesIsSpecial(ns: NS, hostname: string) {
    return hostname == "n00dles" && ns.getHackingLevel() == 1;
}

function canHarvest(ns: NS, hostname: string) {
    return ns.getHackingLevel() >= ns.getServerRequiredHackingLevel(hostname);
}

function worthHarvesting(ns: NS, hostname: string) {
    return expectedValuePerRamSecond(ns, hostname, CONFIG.batchInterval) > 100;
}
