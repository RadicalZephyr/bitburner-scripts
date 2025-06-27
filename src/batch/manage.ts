import type { NetscriptPort, NS } from "netscript";

import { MANAGER_PORT, Message, MessageType } from "batch/client/manage";
import { MemoryClient, registerAllocationOwnership } from "./client/memory";
import { MonitorClient } from "batch/client/monitor";

import { CONFIG } from "batch/config";
import { expectedValuePerRamSecond } from "batch/expected_value";
import { launch } from "batch/launch";

import { calculateWeakenThreads } from "./till";
import { calculateSowThreads } from "./sow";
import { calculateBatchLogistics } from "./harvest";

import { readAllFromPort } from "util/ports";


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
        return expectedValuePerRamSecond(ns, tb, CONFIG.batchInterval)
            - expectedValuePerRamSecond(ns, ta, CONFIG.batchInterval);
    };

    ns.disableLog("ALL");
    ns.ui.openTail();
    ns.ui.moveTail(730, 0);
    ns.print(`INFO: starting manager on ${ns.getHostname()}`);

    let targetsPort = ns.getPortHandle(MANAGER_PORT);

    let monitor = new MonitorClient(ns);
    let memory = new MemoryClient(ns);
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
        await tick(ns, memory, manager);
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
    pendingSowTargets: string[];
    pendingHarvestTargets: string[];

    hackHistory: { time: number, level: number }[];
    velocity: number;

    constructor(ns: NS, monitor: MonitorClient) {
        this.ns = ns;
        this.monitor = monitor;

        this.allTargets = new Set();

        this.pendingTargets = [];
        this.pendingSowTargets = [];
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

    async finishTilling(hostname: string) {
        this.tillTargets.delete(hostname);
        this.ns.print(`INFO: queued sow on ${hostname}`);
        this.pendingSowTargets.push(hostname);
    }

    async finishSowing(hostname: string) {
        this.sowTargets.delete(hostname);
        this.ns.print(`INFO: queued harvest for ${hostname}`);
        this.monitor.pendingHarvesting(hostname);
        this.pendingHarvestTargets.push(hostname);
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

    async launchPendingTasks(freeRam: number) {
        type Task = {
            host: string;
            type: "till" | "sow" | "harvest";
            ram: number;
            threads?: number;
            value: number;
        };

        const tasks: Task[] = [];

        if (this.tillTargets.size < CONFIG.maxTillTargets) {
            const canAdd = CONFIG.maxTillTargets - this.tillTargets.size;
            let candidates: string[] = [];
            if (this.ns.getHackingLevel() === 1) {
                if (this.pendingTargets.includes("n00dles")) {
                    candidates = ["n00dles"];
                }
            } else if (Math.abs(this.velocity) <= 0.05) {
                candidates = [...this.pendingTargets];
            }
            candidates.sort(compareExpectedValue);
            for (const host of candidates.slice(0, canAdd)) {
                const threads = calculateWeakenThreads(this.ns, host);
                const ram = threads * this.ns.getScriptRam("/batch/w.js");
                const value = expectedValuePerRamSecond(this.ns, host, CONFIG.batchInterval);
                tasks.push({ host, type: "till", ram, threads, value });
            }
        }

        for (const host of this.pendingSowTargets) {
            const { growThreads, weakenThreads } = calculateSowThreads(this.ns, host);
            const total = growThreads + weakenThreads;
            const ram = growThreads * this.ns.getScriptRam("/batch/g.js") +
                weakenThreads * this.ns.getScriptRam("/batch/w.js");
            const value = expectedValuePerRamSecond(this.ns, host, CONFIG.batchInterval);
            tasks.push({ host, type: "sow", ram, threads: total, value });
        }

        for (const host of this.pendingHarvestTargets) {
            if (!canHarvest(this.ns, host) || !worthHarvesting(this.ns, host)) {
                continue;
            }
            const logistics = calculateBatchLogistics(this.ns, host);
            const ram = logistics.requiredRam;
            const value = expectedValuePerRamSecond(this.ns, host, CONFIG.batchInterval);
            tasks.push({ host, type: "harvest", ram, value });
        }

        tasks.sort((a, b) => b.value - a.value);

        for (const t of tasks) {
            if (t.ram > freeRam) continue;
            freeRam -= t.ram;
            switch (t.type) {
                case "till":
                    await this.launchTill(t.host, t.threads ?? 0);
                    break;
                case "sow":
                    await this.launchSow(t.host, t.threads ?? 0);
                    break;
                case "harvest":
                    await this.launchHarvest(t.host);
                    break;
            }
        }
    }

    private async launchTill(host: string, threads: number) {
        this.pendingTargets = this.pendingTargets.filter(h => h !== host);
        this.ns.print(`INFO: launching till on ${host}`);
        await launch(
            this.ns,
            "/batch/till.js",
            { threads: 1, allocationFlag: "--allocation-id" },
            host,
            "--max-threads",
            threads,
        );
        this.tillTargets.add(host);
        await this.monitor.tilling(host);
    }

    private async launchSow(host: string, threads: number) {
        this.pendingSowTargets = this.pendingSowTargets.filter(h => h !== host);
        this.ns.print(`INFO: launching sow on ${host}`);
        await launch(
            this.ns,
            "/batch/sow.js",
            { threads: 1, allocationFlag: "--allocation-id" },
            host,
            "--max-threads",
            threads,
        );
        this.sowTargets.add(host);
        await this.monitor.sowing(host);
    }

    private async launchHarvest(host: string) {
        this.pendingHarvestTargets = this.pendingHarvestTargets.filter(h => h !== host);
        this.ns.print(`INFO: launching harvest on ${host}`);
        await launch(
            this.ns,
            "/batch/harvest.js",
            { threads: 1, allocationFlag: "--allocation-id" },
            host,
        );
        await this.monitor.harvesting(host);
        this.harvestTargets.add(host);
    }

}

async function tick(ns: NS, memory: MemoryClient, manager: TargetSelectionManager) {
    manager.updateVelocity();

    const freeRam = await memory.getFreeRam();
    await manager.launchPendingTasks(freeRam);
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
