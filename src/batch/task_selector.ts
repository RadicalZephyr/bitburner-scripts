import type { NetscriptPort, NS } from "netscript";

import { TASK_SELECTOR_PORT, TASK_SELECTOR_RESPONSE_PORT, Message, MessageType, Heartbeat, Lifecycle } from "batch/client/task_selector";
import { MonitorClient, Lifecycle as MonitorLifecycle } from "batch/client/monitor";

import { CONFIG } from "batch/config";
import { expectedValuePerRamSecond } from "batch/expected_value";

import { calculateWeakenThreads } from "batch/till";
import { calculateSowThreads } from "batch/sow";
import { calculateBatchLogistics } from "batch/harvest";

import { DiscoveryClient } from "services/client/discover";
import { MemoryClient, registerAllocationOwnership } from "services/client/memory";
import { launch } from "services/launch";

import { readAllFromPort } from "util/ports";

interface PendingLaunch {
    pid: number;
    host: string;
    type: "till" | "sow" | "harvest";
    time: number;
}


let compareExpectedValue: (ta: string, tb: string) => number;
let compareLevel: (ta: string, tb: string) => number;

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
        await registerAllocationOwnership(ns, allocationId, "self");
    }

    compareExpectedValue = (ta, tb) => {
        return expectedValuePerRamSecond(ns, tb)
            - expectedValuePerRamSecond(ns, ta);
    };
    compareLevel = (ta, tb) => {
        return ns.getServerRequiredHackingLevel(ta)
            - ns.getServerRequiredHackingLevel(tb);
    };

    ns.disableLog("ALL");
    ns.ui.openTail();
    ns.ui.setTailTitle("Task Selector");
    ns.ui.moveTail(720, 0);
    ns.print(`INFO: starting manager on ${ns.getHostname()}`);

    const taskSelectorPort = ns.getPortHandle(TASK_SELECTOR_PORT);
    const responsePort = ns.getPortHandle(TASK_SELECTOR_RESPONSE_PORT);

    let discovery = new DiscoveryClient(ns);
    let monitor = new MonitorClient(ns);
    let memory = new MemoryClient(ns);
    let manager = new TaskSelector(ns, monitor);

    ns.print(`INFO: requesting targets from Discovery service`);
    let targets = await discovery.requestTargets({ messageType: MessageType.NewTarget, port: TASK_SELECTOR_PORT });

    ns.print(`INFO: received targets from Discovery service: ${targets.join(", ")}`);
    for (const target of targets) {
        manager.pushTarget(target);
    }

    let hostsMessagesWaiting = true;

    while (true) {
        if (hostsMessagesWaiting) {
            hostsMessagesWaiting = false;
            taskSelectorPort.nextWrite().then(_ => { hostsMessagesWaiting = true; });
            await readHostsFromPort(ns, taskSelectorPort, responsePort, manager, monitor);
        }
        await tick(ns, memory, manager);
        await ns.sleep(100);
    }
}

async function readHostsFromPort(
    ns: NS,
    managerPort: NetscriptPort,
    responsePort: NetscriptPort,
    manager: TaskSelector,
    monitor: MonitorClient
) {
    for (let nextMsg of readAllFromPort(ns, managerPort)) {
        if (typeof nextMsg === "object") {
            let nextHostMsg = nextMsg as Message;
            let payload = nextHostMsg[2];
            switch (nextHostMsg[0]) {
                case MessageType.NewTarget:
                    const targets = Array.isArray(payload) ? payload : [payload as string];
                    ns.print(`INFO: received target ${targets.join(', ')}`);
                    for (const t of targets) {
                        await manager.pushTarget(t);
                    }
                    break;

                case MessageType.FinishedTilling:
                    ns.print(`SUCCESS: finished tilling ${payload}`);
                    await monitor.sowing(payload as string);
                    await manager.pushTarget(payload as string);
                    break;

                case MessageType.FinishedSowing:
                    ns.print(`SUCCESS: finished sowing ${payload}`);
                    await manager.pushTarget(payload as string);
                    break;

                case MessageType.Heartbeat:
                    ns.print(`INFO: heartbeat from ${(payload as Heartbeat).target}`);
                    await manager.handleHeartbeat(payload as Heartbeat);
                    break;

                case MessageType.RequestLifecycle:
                    const requestId = nextHostMsg[1] as string;
                    const snapshot = manager.snapshotLifecycle();
                    while (!responsePort.tryWrite([requestId, snapshot])) {
                        await ns.sleep(20);
                    }
                    break;
            }
        }
    }
}

class TaskSelector {
    ns: NS;
    monitor: MonitorClient;

    allTargets: Set<string> = new Set();

    tillTargets: Set<string> = new Set();
    sowTargets: Set<string> = new Set();

    harvestTargets: Set<string> = new Set();

    pendingTillTargets: string[] = [];
    pendingSowTargets: string[] = [];
    pendingHarvestTargets: string[] = [];

    pendingLaunches: PendingLaunch[] = [];

    hackHistory: { time: number, level: number }[] = [];
    velocity: number = 0;

    constructor(ns: NS, monitor: MonitorClient) {
        this.ns = ns;
        this.monitor = monitor;
    }

    /**
     * Categorize and enqueue `target` based on its current state.
     *
     * - If security exceeds minimum by more than one, queue for tilling and
     *   notify the monitor via `pending()`.
     * - If security is acceptable but funds are below max, queue for sowing.
     * - If both security and funds are optimal, queue for harvesting and notify
     *   the monitor via `pendingHarvesting()`.
     */
    async pushTarget(target: string) {
        if (!this.allTargets.has(target))
            this.allTargets.add(target);

        this.pendingTillTargets = this.pendingTillTargets.filter(h => h !== target);
        this.pendingSowTargets = this.pendingSowTargets.filter(h => h !== target);
        this.pendingHarvestTargets = this.pendingHarvestTargets.filter(h => h !== target);

        this.tillTargets.delete(target);
        this.sowTargets.delete(target);
        this.harvestTargets.delete(target);

        const minSec = this.ns.getServerMinSecurityLevel(target);
        const curSec = this.ns.getServerSecurityLevel(target);
        const maxMoney = this.ns.getServerMaxMoney(target);
        const curMoney = this.ns.getServerMoneyAvailable(target);

        if (curSec > minSec + CONFIG.minSecTolerance) {
            this.ns.print(`INFO: queue till ${target}`);
            this.pendingTillTargets.push(target);
            await this.monitor.pendingTilling(target);
            return;
        }

        if (curMoney < maxMoney * CONFIG.maxMoneyTolerance) {
            this.ns.print(`INFO: queue sow ${target}`);
            this.pendingSowTargets.push(target);
            await this.monitor.pendingSowing(target);
            return;
        }

        this.ns.print(`INFO: queue harvest ${target}`);
        this.pendingHarvestTargets.push(target);
        await this.monitor.pendingHarvesting(target);
    }

    /**
     * Update internal tracking based on a heartbeat from a worker script.
     */
    async handleHeartbeat(hb: Heartbeat) {
        this.pendingLaunches = this.pendingLaunches.filter(pl => pl.pid !== hb.pid);
        this.allTargets.add(hb.target);

        this.pendingTillTargets = this.pendingTillTargets.filter(h => h !== hb.target);
        this.pendingSowTargets = this.pendingSowTargets.filter(h => h !== hb.target);
        this.pendingHarvestTargets = this.pendingHarvestTargets.filter(h => h !== hb.target);

        this.tillTargets.delete(hb.target);
        this.sowTargets.delete(hb.target);
        this.harvestTargets.delete(hb.target);

        switch (hb.lifecycle) {
            case Lifecycle.Till:
                this.tillTargets.add(hb.target);
                break;
            case Lifecycle.Sow:
                this.sowTargets.add(hb.target);
                break;
            case Lifecycle.Harvest:
                this.harvestTargets.add(hb.target);
                break;
        }
    }

    /**
     * Get a snapshot of the lifecycle state for all tracked hosts.
     *
     * @returns Array of `[hostname, Lifecycle]` pairs for display.
     */
    snapshotLifecycle(): [string, MonitorLifecycle][] {
        const result: [string, MonitorLifecycle][] = [];
        const pushAll = (hosts: Iterable<string>, phase: MonitorLifecycle) => {
            for (const h of hosts) result.push([h, phase]);
        };
        pushAll(this.pendingTillTargets, MonitorLifecycle.PendingTilling);
        pushAll(this.tillTargets, MonitorLifecycle.Tilling);
        pushAll(this.pendingSowTargets, MonitorLifecycle.PendingSowing);
        pushAll(this.sowTargets, MonitorLifecycle.Sowing);
        pushAll(this.pendingHarvestTargets, MonitorLifecycle.PendingHarvesting);
        pushAll(this.harvestTargets, MonitorLifecycle.Harvesting);
        return result;
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

    private async checkPendingLaunches() {
        const now = Date.now();
        const stillWaiting: PendingLaunch[] = [];
        for (const launch of this.pendingLaunches) {
            if (now - launch.time > CONFIG.heartbeatTimeoutMs && !this.ns.isRunning(launch.pid)) {
                this.ns.print(`WARN: launch of ${launch.type} on ${launch.host} failed`);
                await this.pushTarget(launch.host);
            } else {
                stillWaiting.push(launch);
            }
        }
        this.pendingLaunches = stillWaiting;
    }

    async launchPendingTasks(freeRam: number) {
        await this.checkPendingLaunches();
        if (this.pendingLaunches.length > 0) return;

        const harvestTasks = [...this.pendingHarvestTargets]
            .filter(h => canHarvest(this.ns, h) && worthHarvesting(this.ns, h))
            .map(h => ({
                host: h,
                value: expectedValuePerRamSecond(this.ns, h),
                ...calculateBatchLogistics(this.ns, h)
            }))
            .sort((a, b) => b.value - a.value);

        const harvestScriptRam = this.ns.getScriptRam("/batch/harvest.js", "home");
        const sowScriptRam = this.ns.getScriptRam("/batch/sow.js", "home");
        const tillScriptRam = this.ns.getScriptRam("/batch/till.js", "home");

        const hRam = this.ns.getScriptRam("/batch/h.js", "home");
        const gRam = this.ns.getScriptRam("/batch/g.js", "home");
        const wRam = this.ns.getScriptRam("/batch/w.js", "home");

        let fallbackHarvest: string | null = null;
        for (const task of harvestTasks) {
            if (harvestScriptRam + task.requiredRam * task.overlap <= freeRam) {
                await this.launchHarvest(task.host);
                return;
            }
            if (!fallbackHarvest) fallbackHarvest = task.host;
        }

        const minimalHarvestRam = hRam + gRam + 2 * wRam;
        if (fallbackHarvest && freeRam > minimalHarvestRam) {
            await this.launchHarvest(fallbackHarvest, freeRam);
            return;
        }

        if (this.sowTargets.size < CONFIG.maxSowTargets) {
            const canAdd = CONFIG.maxSowTargets - this.sowTargets.size;
            let candidates: string[] = [];

            if (this.pendingSowTargets.includes("n00dles")) {
                candidates = ["n00dles"];
            } else if (this.pendingSowTargets.includes("foodnstuff")) {
                candidates = ["foodnstuff"];
            } else if (Math.abs(this.velocity) <= 0.05) {
                candidates = [...this.pendingSowTargets];
            }
            candidates.sort(compareLevel);


            let fallback: string | null = null;
            for (const host of candidates.slice(0, canAdd)) {
                const { growThreads, weakenThreads } = calculateSowThreads(this.ns, host);
                const total = growThreads + weakenThreads;
                const ram = growThreads * gRam + weakenThreads * wRam;
                if (sowScriptRam + ram <= freeRam) {
                    await this.launchSow(host, total);
                    return;
                }
                if (!fallback) fallback = host;
            }

            const minimalSowRam = sowScriptRam + gRam + wRam;
            if (fallback && freeRam > minimalSowRam) {
                const maxRamPerThread = Math.max(gRam, wRam);
                const threads = Math.floor(freeRam / maxRamPerThread);
                if (threads > 0) {
                    await this.launchSow(fallback, threads);
                    return;
                }
            }
        }

        if (this.tillTargets.size < CONFIG.maxTillTargets) {
            const canAdd = CONFIG.maxTillTargets - this.tillTargets.size;
            let candidates: string[] = [];

            if (this.pendingTillTargets.includes("n00dles")) {
                candidates = ["n00dles"];
            } else if (this.pendingTillTargets.includes("foodnstuff")) {
                candidates = ["foodnstuff"];
            } else if (Math.abs(this.velocity) <= 0.05) {
                candidates = [...this.pendingTillTargets];
            }
            candidates.sort(compareLevel);

            let fallback: string | null = null;
            for (const host of candidates.slice(0, canAdd)) {
                const threads = calculateWeakenThreads(this.ns, host);
                const ram = threads * wRam;
                if (tillScriptRam + ram <= freeRam) {
                    await this.launchTill(host, threads);
                    return;
                }
                if (!fallback) fallback = host;
            }

            const minimalTillRam = tillScriptRam + wRam;
            if (fallback && freeRam > minimalTillRam) {
                const threadRam = wRam;
                const threads = Math.floor(freeRam / threadRam);
                if (threads > 0) {
                    await this.launchTill(fallback, threads);
                    return;
                }
            }
        }
    }

    private async launchTill(host: string, threads: number) {
        this.ns.print(`INFO: launching till on ${host}`);
        const result = await launch(
            this.ns,
            "/batch/till.js",
            { threads: 1, allocationFlag: "--allocation-id" },
            host,
            "--max-threads",
            threads,
        );
        if (result && result.pids.length >= 1) {
            this.pendingTillTargets = this.pendingTillTargets.filter(h => h !== host);
            this.pendingLaunches.push({ pid: result.pids[0], host, type: "till", time: Date.now() });
            await this.monitor.tilling(host);
        }
    }

    private async launchSow(host: string, threads: number) {
        this.ns.print(`INFO: launching sow on ${host}`);
        let result = await launch(
            this.ns,
            "/batch/sow.js",
            { threads: 1, allocationFlag: "--allocation-id" },
            host,
            "--max-threads",
            threads,
        );
        if (result && result.pids.length >= 1) {
            this.pendingSowTargets = this.pendingSowTargets.filter(h => h !== host);
            this.pendingLaunches.push({ pid: result.pids[0], host, type: "sow", time: Date.now() });
            await this.monitor.sowing(host);
        }
    }

    private async launchHarvest(host: string, maxRam?: number) {
        this.ns.print(`INFO: launching harvest on ${host}`);
        let args = maxRam !== undefined ? [host, "--max-ram", maxRam] : [host];
        let result = await launch(
            this.ns,
            "/batch/harvest.js",
            { threads: 1, allocationFlag: "--allocation-id" },
            ...args,
        );
        if (result && result.pids.length >= 1) {
            this.pendingHarvestTargets = this.pendingHarvestTargets.filter(h => h !== host);
            this.pendingLaunches.push({ pid: result.pids[0], host, type: "harvest", time: Date.now() });
            await this.monitor.harvesting(host);
        }
    }

}

async function tick(ns: NS, memory: MemoryClient, manager: TaskSelector) {
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
    return expectedValuePerRamSecond(ns, hostname) > CONFIG.expectedValueThreshold;
}
