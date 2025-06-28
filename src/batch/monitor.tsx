import type { NS, UserInterfaceTheme } from "netscript";

import { registerAllocationOwnership } from "batch/client/memory";
import { Lifecycle, Message as MonitorMessage } from "batch/client/monitor";

import { CONFIG } from "batch/config";
import { expectedValuePerRamSecond } from "batch/expected_value";

import { readAllFromPort, MONITOR_PORT } from "util/ports";


declare const React: any;

export async function main(ns: NS) {
    const flags = ns.flags([
        ['allocation-id', -1],
        ['refreshrate', 200],
        ['help', false],
    ]);

    const rest = flags._ as string[];
    if (rest.length !== 0 || flags.help || typeof flags.refreshrate != 'number') {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

This script helps visualize the money and security of all servers.

OPTIONS
--refreshrate   Time to sleep between refreshing server data

Example:

> run ${ns.getScriptName()}
`);
        return;
    }

    let allocationId = flags['allocation-id'];
    if (allocationId !== -1) {
        if (typeof allocationId !== 'number') {
            ns.tprint('--allocation-id must be a number');
            return;
        }
        registerAllocationOwnership(ns, allocationId, "self");
    }


    ns.disableLog('ALL');
    ns.clearLog();
    ns.ui.openTail();
    ns.ui.resizeTail(870, 640);
    ns.ui.moveTail(1230, 0);

    const monitorPort = ns.getPortHandle(MONITOR_PORT);
    const workers: string[] = [];
    const lifecycleByHost: Map<string, Lifecycle> = new Map();
    let monitorMessagesWaiting = true;

    while (true) {
        if (monitorMessagesWaiting) {
            for (const nextMsg of readAllFromPort(ns, monitorPort)) {
                if (typeof nextMsg === "object") {
                    const [phase, host] = nextMsg as MonitorMessage;
                    if (phase === Lifecycle.Worker) {
                        workers.push(host);
                    } else {
                        lifecycleByHost.set(host, phase);
                    }
                }
            }
            monitorMessagesWaiting = false;
            monitorPort.nextWrite().then(_ => { monitorMessagesWaiting = true; });
        }

        let threadsByTarget = countThreadsByTarget(ns, workers, Array.from(lifecycleByHost.keys()));
        const harvesting: HostInfo[] = [];
        const pendingHarvesting: HostInfo[] = [];
        const sowing: HostInfo[] = [];
        const pendingSowing: HostInfo[] = [];
        const tilling: HostInfo[] = [];
        const pendingTilling: HostInfo[] = [];

        for (const [host, phase] of lifecycleByHost.entries()) {
            if (host === "home"
                || host.startsWith("pserv")
                || ns.getServerMaxMoney(host) <= 0)
                continue;

            const info = hostInfo(ns, host, threadsByTarget.get(host));
            switch (phase) {
                case Lifecycle.Worker:
                    break;
                case Lifecycle.Harvesting:
                    harvesting.push(info);
                    break;
                case Lifecycle.PendingHarvesting:
                    pendingHarvesting.push(info);
                    break;
                case Lifecycle.Sowing:
                    sowing.push(info);
                    break;
                case Lifecycle.PendingSowing:
                    pendingSowing.push(info);
                    break;
                case Lifecycle.Tilling:
                    tilling.push(info);
                    break;
                default:
                    pendingTilling.push(info);
                    break;
            }
        }

        let theme = ns.ui.getTheme();

        ns.clearLog();
        ns.printRaw(<>
            <ServerBlock title={"Harvesting"} targets={harvesting} theme={theme}></ServerBlock>
            <ServerBlock title={"Pending Harvesting"} targets={pendingHarvesting} theme={theme}></ServerBlock>
            <ServerBlock title={"Sowing"} targets={sowing} theme={theme}></ServerBlock>
            <ServerBlock title={"Pending Sowing"} targets={pendingSowing} theme={theme}></ServerBlock>
            <ServerBlock title={"Tilling"} targets={tilling} theme={theme}></ServerBlock>
            <ServerBlock title={"Pending Tilling"} targets={pendingTilling} theme={theme}></ServerBlock>
        </>);
        await ns.sleep(flags.refreshrate);
    }
}

export class TargetThreads {
    h: number;
    hPid: number[];

    g: number;
    gPid: number[];

    w: number;
    wPid: number[];

    harvestMoney: number;
    harvestPids: number[];

    sowPids: number[];

    constructor() {
        this.h = 0;
        this.hPid = [];

        this.g = 0;
        this.gPid = [];

        this.w = 0;
        this.wPid = [];

        this.harvestMoney = 0;
        this.harvestPids = [];

        this.sowPids = [];
    }
}

export function countThreadsByTarget(ns: NS, workers: string[], targets: string[]): Map<string, TargetThreads> {
    let targetThreads = new Map(targets.map(h => [h, new TargetThreads()]));

    for (const host of workers) {
        for (const pi of ns.ps(host)) {

            let target = pi.args[0] === "--allocation-id" ? pi.args[2] : pi.args[0];

            if (typeof target != 'string') continue;

            let targetThread = targetThreads.get(target);

            if (pi.filename === 'batch/harvest.js') {
                targetThread.harvestPids.push(pi.pid);
                targetThread.harvestMoney = ns.getScriptIncome(pi.filename, host, ...pi.args);
            } else if (pi.filename === 'batch/sow.js') {
                targetThread.sowPids.push(pi.pid);
            } else if (pi.filename === 'batch/h.js') {
                targetThread.hPid.push(pi.pid);
                targetThread.h += pi.threads;
            } else if (pi.filename === 'batch/g.js') {
                targetThread.gPid.push(pi.pid);
                targetThread.g += pi.threads;
            } else if (pi.filename === 'batch/w.js') {
                targetThread.wPid.push(pi.pid);
                targetThread.w += pi.threads;
            }
        }
    }

    return targetThreads;
}

export type HostInfo = {
    name: string,
    milkMoney: string
    expectedValue: string,
    hckLevel: string,
    maxMoney: string,
    moneyPercent: string
    secPlus: string,
    threadsH: string,
    threadsG: string,
    threadsW: string
}

export function hostInfo(ns: NS, target: string, targetThreads: TargetThreads): HostInfo {
    let hckLevel = ns.getServerRequiredHackingLevel(target);
    hckLevel = typeof hckLevel == "number" && !isNaN(hckLevel) ? hckLevel : 1;
    const minSec = ns.getServerMinSecurityLevel(target);
    const sec = ns.getServerSecurityLevel(target);

    const money = ns.getServerMaxMoney(target);
    const moneyPercent = moneyPercentage(ns, target) * 100;
    const secPlus = sec - minSec;

    const milkMoney = targetThreads.harvestMoney;
    const eValue = expectedValuePerRamSecond(ns, target, CONFIG.batchInterval);

    return {
        name: target,
        milkMoney: Math.abs(milkMoney) < 0 ? '' : "$" + ns.formatNumber(milkMoney, 2),
        expectedValue: "$" + ns.formatNumber(eValue, 2),
        hckLevel: ns.formatNumber(hckLevel, 0, 1000000, true),
        maxMoney: "$" + ns.formatNumber(money, 2),
        moneyPercent: Math.abs(moneyPercent - 100) < 0.1 ? '100.0%' : ns.formatPercent(moneyPercent / 100),
        secPlus: Math.abs(secPlus) < 0.1 ? '+0.0' : "+" + ns.formatNumber(secPlus, 2),
        threadsH: formatThreads(ns, targetThreads.h),
        threadsG: formatThreads(ns, targetThreads.g),
        threadsW: formatThreads(ns, targetThreads.w)
    };
}

function moneyPercentage(ns: NS, host: string): number {
    const curMoney = ns.getServerMoneyAvailable(host);
    const maxMoney = ns.getServerMaxMoney(host);
    return maxMoney != 0.0 && maxMoney != -0.0 ? curMoney / maxMoney : 0.0;
}

function formatThreads(ns: NS, threads: number): string {
    if (threads < 1) {
        return '';
    }

    return ns.formatNumber(threads, 2, 1000, true);
}

interface IBlockSettings {
    title: string,
    targets: HostInfo[],
    theme: UserInterfaceTheme,
}

export function ServerBlock({ title, targets, theme }: IBlockSettings) {
    const cellStyle = { padding: "0 0.5em" };
    return (<>
        <h2>{title}</h2>
        <table>
            <thead>
                <tr>
                    <th style={cellStyle}>target</th>
                    <th style={cellStyle}>$/s</th>
                    <th style={cellStyle}>E($/GBs)</th>
                    <th style={cellStyle}>lvl</th>
                    <th style={cellStyle}>$</th>
                    <th style={cellStyle}>⌈$⌉%</th>
                    <th style={cellStyle}>+sec</th>
                    <th style={cellStyle}>thr(h)</th>
                    <th style={cellStyle}>thr(g)</th>
                    <th style={cellStyle}>thr(w)</th>
                </tr>
            </thead>
            {targets.map((target, idx) => <ServerRow host={target} theme={theme} rowIndex={idx} cellStyle={cellStyle}></ServerRow>)}
        </table>
    </>);
}

interface IRowSettings {
    host: HostInfo,
    rowIndex: number,
    cellStyle: any,
    theme: UserInterfaceTheme,
}

function ServerRow({ host, rowIndex, cellStyle, theme }: IRowSettings) {
    return (
        <tr key={host.name} style={rowIndex % 2 === 1 ? undefined : { backgroundColor: theme.well }}>
            <td style={cellStyle}>{host.name}</td>
            <td style={cellStyle}>{host.milkMoney}</td>
            <td style={cellStyle}>{host.expectedValue}</td>
            <td style={cellStyle}>{host.hckLevel}</td>
            <td style={cellStyle}>{host.maxMoney}</td>
            <td style={cellStyle}>{host.moneyPercent}</td>
            <td style={cellStyle}>{host.secPlus}</td>
            <td style={cellStyle}>{host.threadsH}</td>
            <td style={cellStyle}>{host.threadsG}</td>
            <td style={cellStyle}>{host.threadsW}</td>
        </tr>
    );
}
