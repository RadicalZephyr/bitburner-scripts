import type { NetscriptPort, NS } from 'netscript';
import { ALLOC_ID, MEM_TAG_FLAGS } from 'services/client/memory_tag';

import {
    TASK_SELECTOR_PORT,
    TASK_SELECTOR_RESPONSE_PORT,
    Message,
    MessageType,
    Heartbeat,
    Lifecycle,
} from 'batch/client/task_selector';
import {
    MonitorClient,
    Lifecycle as MonitorLifecycle,
} from 'batch/client/monitor';

import { CONFIG } from 'batch/config';
import {
    calculateBatchLogistics,
    expectedValueForMemory,
    maxHackPercentForMemory,
    availableBatchCount,
} from 'batch/expected_value';
import type { BatchLogistics } from 'services/batch';
import { calculateWeakenThreads } from 'batch/till';
import { calculateSowThreads } from 'batch/sow';

import { DiscoveryClient } from 'services/client/discover';
import {
    MemoryClient,
    parseAndRegisterAlloc,
    type FreeRam,
} from 'services/client/memory';
import { LaunchClient } from 'services/client/launch';
import { PortClient } from 'services/client/port';

import { growthAnalyze } from 'util/growthAnalyze';
import { readAllFromPort, readLoop } from 'util/ports';
import { sleep } from 'util/time';
import { HUD_HEIGHT, KARMA_HEIGHT } from 'util/ui';

interface InProgressTask {
    pid: number;
    host: string;
    type: 'till' | 'sow' | 'harvest';
    max: number | undefined;
    expectedTime: number | undefined;
}

interface LaunchedTask extends InProgressTask {
    time: number;
}

interface HarvestTask extends BatchLogistics {
    host: string;
    hackPercent: number;
    profit: number;
    value: number;
}

function makeCompareLevel(ns: NS): (ta: string, tb: string) => number {
    return (ta, tb) => {
        return (
            ns.getServerRequiredHackingLevel(ta)
            - ns.getServerRequiredHackingLevel(tb)
        );
    };
}

export async function main(ns: NS) {
    const flags = ns.flags([...MEM_TAG_FLAGS]);

    const allocationId = await parseAndRegisterAlloc(ns, flags);
    if (flags[ALLOC_ID] !== -1 && allocationId === null) {
        return;
    }

    ns.disableLog('ALL');
    ns.ui.openTail();
    ns.ui.setTailTitle('Task Selector');

    const WIDTH = 500;
    ns.ui.resizeTail(WIDTH, 500);

    const [ww] = ns.ui.windowSize();
    ns.ui.moveTail(ww - WIDTH, HUD_HEIGHT + KARMA_HEIGHT);
    ns.print(`INFO: starting manager on ${ns.getHostname()}`);

    const taskSelectorPort = ns.getPortHandle(TASK_SELECTOR_PORT);
    const responsePort = ns.getPortHandle(TASK_SELECTOR_RESPONSE_PORT);

    const discovery = new DiscoveryClient(ns);
    const monitor = new MonitorClient(ns);
    const memory = new MemoryClient(ns);
    const launcher = new LaunchClient(ns);
    const manager = new TaskSelector(ns, monitor, launcher);

    ns.print(`INFO: requesting targets from Discovery service`);
    const targets = await discovery.requestTargets({
        messageType: MessageType.NewTarget,
        port: TASK_SELECTOR_PORT,
    });

    ns.print(
        `INFO: received targets from Discovery service: ${targets.join(', ')}`,
    );
    for (const target of targets) {
        manager.pushTarget(target);
    }

    readLoop(ns, taskSelectorPort, () =>
        readHostsFromPort(ns, taskSelectorPort, responsePort, manager, monitor),
    );

    while (true) {
        await tick(ns, memory, manager);
        await sleep(CONFIG.taskSelectorTickMs);
    }
}

async function readHostsFromPort(
    ns: NS,
    managerPort: NetscriptPort,
    responsePort: NetscriptPort,
    manager: TaskSelector,
    monitor: MonitorClient,
) {
    for (const nextMsg of readAllFromPort(ns, managerPort)) {
        if (typeof nextMsg === 'object') {
            const nextHostMsg = nextMsg as Message;
            const payload = nextHostMsg[2];
            switch (nextHostMsg[0]) {
                case MessageType.NewTarget: {
                    const targets = Array.isArray(payload)
                        ? payload
                        : [payload as string];
                    ns.print(`INFO: received target ${targets.join(', ')}`);
                    for (const t of targets) {
                        await manager.pushTarget(t);
                    }
                    break;
                }
                case MessageType.FinishedTilling: {
                    ns.print(`SUCCESS: finished tilling ${payload}`);
                    await monitor.sowing(payload as string);
                    await manager.pushTarget(payload as string);
                    break;
                }
                case MessageType.FinishedSowing: {
                    ns.print(`SUCCESS: finished sowing ${payload}`);
                    await manager.pushTarget(payload as string);
                    break;
                }
                case MessageType.Heartbeat: {
                    ns.print(
                        `INFO: heartbeat from ${(payload as Heartbeat).target}`,
                    );
                    await manager.handleHeartbeat(payload as Heartbeat);
                    break;
                }
                case MessageType.RequestLifecycle: {
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
}

class TaskSelector {
    ns: NS;
    monitor: MonitorClient;
    launcher: LaunchClient;

    allTargets: Set<string> = new Set();

    tillTargets: Set<string> = new Set();
    sowTargets: Set<string> = new Set();

    harvestTargets: Set<string> = new Set();

    pendingTillTargets: string[] = [];
    pendingSowTargets: string[] = [];
    pendingHarvestTargets: string[] = [];

    launchedTasks: LaunchedTask[] = [];
    inProgressTasks: InProgressTask[] = [];

    hackHistory: { time: number; level: number }[] = [];
    velocity: number = 0;
    launchFailures: Map<string, { count: number; nextAttempt: number }> =
        new Map();
    activeHarvestProfits: Map<string, number> = new Map();
    harvestPorts: Map<string, number> = new Map();

    constructor(ns: NS, monitor: MonitorClient, launcher: LaunchClient) {
        this.ns = ns;
        this.monitor = monitor;
        this.launcher = launcher;
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
        if (!this.allTargets.has(target)) this.allTargets.add(target);

        if (
            this.harvestTargets.has(target)
            || this.pendingHarvestTargets.includes(target)
        ) {
            this.activeHarvestProfits.delete(target);
            this.harvestPorts.delete(target);
        }

        this.pendingTillTargets = this.pendingTillTargets.filter(
            (h) => h !== target,
        );
        this.pendingSowTargets = this.pendingSowTargets.filter(
            (h) => h !== target,
        );
        this.pendingHarvestTargets = this.pendingHarvestTargets.filter(
            (h) => h !== target,
        );

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
        const idx = this.launchedTasks.findIndex((pl) => pl.pid === hb.pid);
        if (idx !== -1) {
            const [task] = this.launchedTasks.splice(idx, 1);
            this.inProgressTasks.push(task);
        }
        this.resetLaunchFailure(hb.target);
        this.allTargets.add(hb.target);

        this.pendingTillTargets = this.pendingTillTargets.filter(
            (h) => h !== hb.target,
        );
        this.pendingSowTargets = this.pendingSowTargets.filter(
            (h) => h !== hb.target,
        );
        this.pendingHarvestTargets = this.pendingHarvestTargets.filter(
            (h) => h !== hb.target,
        );

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

    private recordLaunchFailure(host: string) {
        const entry = this.launchFailures.get(host) ?? {
            count: 0,
            nextAttempt: 0,
        };
        const count = Math.min(entry.count + 1, CONFIG.launchFailLimit);
        const backoff = CONFIG.launchFailBackoffMs * Math.pow(2, count - 1);
        this.launchFailures.set(host, {
            count,
            nextAttempt: Date.now() + backoff,
        });
    }

    private resetLaunchFailure(host: string) {
        this.launchFailures.delete(host);
    }

    private estimateTillTime(host: string, threads: number): number {
        const weaken = calculateWeakenThreads(this.ns, host);
        if (threads <= 0) return 0;
        const rounds = Math.ceil(weaken / threads);
        return rounds * this.ns.getWeakenTime(host);
    }

    private estimateSowTime(host: string, threads: number): number {
        const maxMoney = this.ns.getServerMaxMoney(host);
        const curMoney = this.ns.getServerMoneyAvailable(host);
        const growThreads = growthAnalyze(this.ns, host, maxMoney, curMoney);
        if (threads <= 0 || !Number.isFinite(threads)) return 0;
        const rounds = Math.ceil(growThreads / threads);
        return rounds * this.ns.getWeakenTime(host);
    }

    private async checkLaunchedTasks() {
        const now = Date.now();
        const stillWaiting: LaunchedTask[] = [];
        for (const launch of this.launchedTasks) {
            if (
                now - launch.time > CONFIG.heartbeatTimeoutMs
                && !this.ns.isRunning(launch.pid)
            ) {
                this.ns.print(
                    `WARN: launch of ${launch.type} on ${launch.host} failed`,
                );
                this.recordLaunchFailure(launch.host);
                await this.pushTarget(launch.host);
            } else {
                stillWaiting.push(launch);
            }
        }
        this.launchedTasks = stillWaiting;
    }

    async launchPendingTasks(memInfo: FreeRam) {
        await this.checkLaunchedTasks();
        if (this.launchedTasks.length > 0) return;

        const totalProfit = Array.from(
            this.activeHarvestProfits.values(),
        ).reduce((acc, p) => acc + p, 0);

        let harvestTasks: HarvestTask[] = [...this.pendingHarvestTargets]
            .filter((h) => canHarvest(this.ns, h))
            .map((h) => {
                const hackPercent = maxHackPercentForMemory(
                    this.ns,
                    h,
                    memInfo,
                );
                const logistics = calculateBatchLogistics(
                    this.ns,
                    h,
                    hackPercent,
                );
                if (
                    hackPercent === 0
                    || availableBatchCount(memInfo.chunks, logistics.batchRam)
                        < 1
                ) {
                    return null;
                }

                const { profit, expectedValue: value } = expectedValueForMemory(
                    this.ns,
                    h,
                    memInfo,
                    hackPercent,
                );
                if (value <= CONFIG.expectedValueThreshold) return null;

                return {
                    host: h,
                    hackPercent,
                    profit,
                    value,
                    ...logistics,
                };
            })
            .filter((t): t is HarvestTask => t !== null)
            .sort((a, b) => b.value - a.value);

        if (totalProfit > 0) {
            harvestTasks = harvestTasks.filter(
                (t) => t.profit >= totalProfit * CONFIG.harvestGainThreshold,
            );
        }

        const harvestScriptRam = this.ns.getScriptRam(
            '/batch/harvest.js',
            'home',
        );
        const sowScriptRam = this.ns.getScriptRam('/batch/sow.js', 'home');
        const tillScriptRam = this.ns.getScriptRam('/batch/till.js', 'home');

        const hRam = this.ns.getScriptRam('/batch/h.js', 'home');
        const gRam = this.ns.getScriptRam('/batch/g.js', 'home');
        const wRam = this.ns.getScriptRam('/batch/w.js', 'home');

        let fallbackHarvest: HarvestTask | null = null;
        for (const task of harvestTasks) {
            const lf = this.launchFailures.get(task.host);
            if (lf && lf.nextAttempt > Date.now()) continue;
            if (
                harvestScriptRam + task.requiredRam <= memInfo.freeRam
                && availableBatchCount(memInfo.chunks, task.batchRam)
                    >= task.overlap
            ) {
                await this.launchHarvest(task);
                return;
            }
            if (!fallbackHarvest || fallbackHarvest.value < task.value)
                fallbackHarvest = task;
        }

        const minimalHarvestRam = hRam + gRam + 2 * wRam;
        if (fallbackHarvest && memInfo.freeRam > minimalHarvestRam) {
            const lf = this.launchFailures.get(fallbackHarvest.host);
            const minLog = calculateBatchLogistics(
                this.ns,
                fallbackHarvest.host,
            );
            const fits =
                availableBatchCount(memInfo.chunks, minLog.batchRam) >= 1;
            if ((!lf || lf.nextAttempt <= Date.now()) && fits) {
                await this.launchHarvest(fallbackHarvest, memInfo.freeRam);
                return;
            }
        }

        if (this.sowTargets.size < CONFIG.maxSowTargets) {
            const canAdd = CONFIG.maxSowTargets - this.sowTargets.size;
            let candidates: string[] = [];

            if (this.pendingSowTargets.includes('n00dles')) {
                candidates = ['n00dles'];
            } else if (this.pendingSowTargets.includes('foodnstuff')) {
                candidates = ['foodnstuff'];
            } else if (
                Math.abs(this.velocity) <= CONFIG.hackLevelVelocityThreshold
            ) {
                candidates = [...this.pendingSowTargets];
            }
            candidates.sort(makeCompareLevel(this.ns));

            let fallback: string | null = null;
            for (const host of candidates.slice(0, canAdd)) {
                const lf = this.launchFailures.get(host);
                if (lf && lf.nextAttempt > Date.now()) continue;
                const { growThreads, weakenThreads } = calculateSowThreads(
                    this.ns,
                    host,
                );
                const total = growThreads + weakenThreads;
                const ram = growThreads * gRam + weakenThreads * wRam;
                if (
                    sowScriptRam + ram <= memInfo.freeRam
                    && availableBatchCount(memInfo.chunks, ram) >= 1
                ) {
                    await this.launchSow(host, total);
                    return;
                }
                if (!fallback) fallback = host;
            }

            const minimalSowRam = sowScriptRam + gRam + wRam;
            if (fallback && memInfo.freeRam > minimalSowRam) {
                const lf = this.launchFailures.get(fallback);
                const fits =
                    availableBatchCount(memInfo.chunks, gRam + wRam) >= 1;
                if (!lf || lf.nextAttempt <= Date.now()) {
                    const maxRamPerThread = Math.max(gRam, wRam);
                    const threads = Math.floor(
                        memInfo.freeRam / maxRamPerThread,
                    );
                    if (threads > 0 && fits) {
                        await this.launchSow(fallback, threads);
                        return;
                    }
                }
            }
        }

        if (this.tillTargets.size < CONFIG.maxTillTargets) {
            const canAdd = CONFIG.maxTillTargets - this.tillTargets.size;
            let candidates: string[] = [];

            if (this.pendingTillTargets.includes('n00dles')) {
                candidates = ['n00dles'];
            } else if (this.pendingTillTargets.includes('foodnstuff')) {
                candidates = ['foodnstuff'];
            } else if (
                Math.abs(this.velocity) <= CONFIG.hackLevelVelocityThreshold
            ) {
                candidates = [...this.pendingTillTargets];
            }
            candidates.sort(makeCompareLevel(this.ns));

            let fallback: string | null = null;
            for (const host of candidates.slice(0, canAdd)) {
                const lf = this.launchFailures.get(host);
                if (lf && lf.nextAttempt > Date.now()) continue;
                const threads = calculateWeakenThreads(this.ns, host);
                const ram = threads * wRam;
                if (
                    tillScriptRam + ram <= memInfo.freeRam
                    && availableBatchCount(memInfo.chunks, ram) >= 1
                ) {
                    await this.launchTill(host, threads);
                    return;
                }
                if (!fallback) fallback = host;
            }

            const minimalTillRam = tillScriptRam + wRam;
            if (fallback && memInfo.freeRam > minimalTillRam) {
                const lf = this.launchFailures.get(fallback);
                const fits = availableBatchCount(memInfo.chunks, wRam) >= 1;
                if (!lf || lf.nextAttempt <= Date.now()) {
                    const threadRam = wRam;
                    const threads = Math.floor(memInfo.freeRam / threadRam);
                    if (threads > 0 && fits) {
                        await this.launchTill(fallback, threads);
                        return;
                    }
                }
            }
        }
    }

    private async launchTill(host: string, threads: number) {
        this.ns.print(`INFO: launching till on ${host}`);
        const result = await this.launcher.launch(
            '/batch/till.js',
            {
                threads: 1,
                alloc: { longRunning: true },
            },
            host,
            '--max-threads',
            threads,
        );
        if (!result || result.pids.length === 0) {
            this.recordLaunchFailure(host);
            return;
        }
        if (result.pids.length >= 1) {
            this.pendingTillTargets = this.pendingTillTargets.filter(
                (h) => h !== host,
            );
            const expected = this.estimateTillTime(host, threads);
            const pid = result.pids[0];
            const task: LaunchedTask = {
                pid,
                host,
                type: 'till',
                max: threads,
                expectedTime: expected,
                time: Date.now(),
            };
            this.launchedTasks.push(task);
            await this.monitor.tilling(host);
        }
    }

    private async launchSow(host: string, threads: number) {
        this.ns.print(`INFO: launching sow on ${host}`);
        const result = await this.launcher.launch(
            '/batch/sow.js',
            {
                threads: 1,
                alloc: { longRunning: true },
            },
            host,
        );
        if (!result || result.pids.length === 0) {
            this.recordLaunchFailure(host);
            return;
        }
        if (result.pids.length >= 1) {
            this.pendingSowTargets = this.pendingSowTargets.filter(
                (h) => h !== host,
            );
            const expected = this.estimateSowTime(host, threads);
            const pid = result.pids[0];
            const task: LaunchedTask = {
                pid,
                host,
                type: 'sow',
                max: threads,
                expectedTime: expected,
                time: Date.now(),
            };
            this.launchedTasks.push(task);
            await this.monitor.sowing(host);
        }
    }

    private async launchHarvest(task: HarvestTask, maxRam?: number) {
        const host = task.host;
        this.ns.print(`INFO: launching harvest on ${host}`);
        const portClient = new PortClient(this.ns);
        const portId = await portClient.requestPort();
        if (typeof portId !== 'number') {
            this.ns.print('WARN: failed to acquire control port');
            this.recordLaunchFailure(host);
            return;
        }

        const args =
            maxRam !== undefined
                ? [host, '--max-ram', maxRam, '--port-id', portId]
                : [host, '--port-id', portId];
        const result = await this.launcher.launch(
            '/batch/harvest.js',
            {
                threads: 1,
                alloc: { longRunning: true },
            },
            ...args,
        );
        if (!result || result.pids.length === 0) {
            this.recordLaunchFailure(host);
            await portClient.releasePort(portId);
            return;
        }
        if (result.pids.length >= 1) {
            this.pendingHarvestTargets = this.pendingHarvestTargets.filter(
                (h) => h !== host,
            );
            this.activeHarvestProfits.set(host, task.profit);
            const pid = result.pids[0];
            this.harvestPorts.set(host, portId);
            const launch: LaunchedTask = {
                pid,
                host,
                type: 'harvest',
                max: maxRam,
                expectedTime: undefined,
                time: Date.now(),
            };
            this.launchedTasks.push(launch);
            await this.monitor.harvesting(host);
        }
    }
}

async function tick(ns: NS, memory: MemoryClient, manager: TaskSelector) {
    manager.updateVelocity();

    const status = await memory.getFreeRam();
    await manager.launchPendingTasks(status);
}

function canHarvest(ns: NS, hostname: string) {
    return ns.getHackingLevel() >= ns.getServerRequiredHackingLevel(hostname);
}
