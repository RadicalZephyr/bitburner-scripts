import type { NS, UserInterfaceTheme } from "netscript";

import { Lifecycle, Message as MonitorMessage } from "batch/client/monitor";

import { expectedValuePerRamSecond } from "batch/expected_value";

import { registerAllocationOwnership } from "services/client/memory";

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
        await registerAllocationOwnership(ns, allocationId, "self");
    }


    ns.disableLog('ALL');
    ns.clearLog();
    ns.ui.openTail();
    ns.ui.resizeTail(915, 650);
    ns.ui.moveTail(1220, 0);

    const monitorPort = ns.getPortHandle(MONITOR_PORT);
    const workers: string[] = ["home"];
    const lifecycleByHost: Map<string, Lifecycle> = new Map();
    let monitorMessagesWaiting = true;

    const tableSortings: Record<string, SortBy> = {
        harvesting: {
            key: "hckLevel",
            dir: Dir.Desc,
            data: [],
        },
        pendingHarvesting: {
            key: "hckLevel",
            dir: Dir.Desc,
            data: [],
        },
        sowing: {
            key: "hckLevel",
            dir: Dir.Desc,
            data: [],
        },
        pendingSowing: {
            key: "hckLevel",
            dir: Dir.Desc,
            data: [],
        },
        tilling: {
            key: "hckLevel",
            dir: Dir.Desc,
            data: [],
        },
        pendingTilling: {
            key: "hckLevel",
            dir: Dir.Desc,
            data: [],
        }
    };

    function setTableSorting(table: string, sortBy: string) {
        if (tableSortings[table].key == sortBy) {
            tableSortings[table].dir = tableSortings[table].dir === Dir.Asc ? Dir.Desc : Dir.Asc;
        } else {
            tableSortings[table].key = sortBy;
            tableSortings[table].dir = Dir.Desc;
        }
    }

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

        tableSortings.harvesting.data = [];
        tableSortings.pendingHarvesting.data = [];
        tableSortings.sowing.data = [];
        tableSortings.pendingSowing.data = [];
        tableSortings.tilling.data = [];
        tableSortings.pendingTilling.data = [];

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
                    tableSortings.harvesting.data.push(info);
                    break;
                case Lifecycle.PendingHarvesting:
                    tableSortings.pendingHarvesting.data.push(info);
                    break;
                case Lifecycle.Sowing:
                    tableSortings.sowing.data.push(info);
                    break;
                case Lifecycle.PendingSowing:
                    tableSortings.pendingSowing.data.push(info);
                    break;
                case Lifecycle.Tilling:
                    tableSortings.tilling.data.push(info);
                    break;
                default:
                    tableSortings.pendingTilling.data.push(info);
                    break;
            }
        }

        for (const phaseName in tableSortings) {
            const phase = tableSortings[phaseName];
            const sortKey = phase.key;
            const phaseTargets = phase.data ?? [];
            if (phaseTargets.length > 0 && phaseTargets[0][sortKey])
                phaseTargets.sort(sortByFn(phase));
        }

        let theme = ns.ui.getTheme();

        ns.clearLog();
        ns.printRaw(<>
            <ServerBlock ns={ns} title={"Harvesting"} phase={tableSortings.harvesting} setTableSorting={setTableSorting.bind(null, "harvesting")} theme={theme}></ServerBlock>
            <ServerBlock ns={ns} title={"Pending Harvesting"} phase={tableSortings.pendingHarvesting} setTableSorting={setTableSorting.bind(null, "pendingHarvesting")} theme={theme}></ServerBlock>
            <ServerBlock ns={ns} title={"Sowing"} phase={tableSortings.sowing} setTableSorting={setTableSorting.bind(null, "sowing")} theme={theme}></ServerBlock>
            <ServerBlock ns={ns} title={"Pending Sowing"} phase={tableSortings.pendingSowing} setTableSorting={setTableSorting.bind(null, "pendingSowing")} theme={theme}></ServerBlock>
            <ServerBlock ns={ns} title={"Tilling"} phase={tableSortings.tilling} setTableSorting={setTableSorting.bind(null, "tilling")} theme={theme}></ServerBlock>
            <ServerBlock ns={ns} title={"Pending Tilling"} phase={tableSortings.pendingTilling} setTableSorting={setTableSorting.bind(null, "pendingTilling")} theme={theme}></ServerBlock>
        </>);
        ns.ui.renderTail();
        await ns.sleep(flags.refreshrate);
    }
}

enum Dir {
    Asc,
    Desc,
}

interface SortBy {
    key: string,
    dir: Dir,
    data: HostInfo[],
}

function sortByFn(sortBy: SortBy) {
    const sortKey = sortBy.key;
    if (sortBy.dir === Dir.Desc) {
        return (a: HostInfo, b: HostInfo) => {
            if (sortKey === "name") {
                return b.name.localeCompare(a.name);
            } else {
                return b[sortKey] - a[sortKey];
            }
        };
    } else {
        return (a: HostInfo, b: HostInfo) => {
            if (sortKey === "name") {
                return a.name.localeCompare(b.name);
            } else {
                return a[sortKey] - b[sortKey];
            }
        };
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
            if (!targetThread) {
                ns.tprint(`found unexpected target ${target} in script args ${pi.filename} args: ${pi.args.join(" ")}`);
                continue;
            }

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
    harvestMoney: number,
    expectedValue: number,
    hckLevel: number,
    maxMoney: number,
    moneyPercent: number,
    secPlus: number,
    threadsH: number,
    threadsG: number,
    threadsW: number
}

export function hostInfo(ns: NS, target: string, targetThreads: TargetThreads): HostInfo {
    let hckLevel = ns.getServerRequiredHackingLevel(target);
    hckLevel = typeof hckLevel == "number" && !isNaN(hckLevel) ? hckLevel : 1;
    const minSec = ns.getServerMinSecurityLevel(target);
    const sec = ns.getServerSecurityLevel(target);

    const maxMoney = ns.getServerMaxMoney(target);
    const moneyPercent = moneyPercentage(ns, target);
    const secPlus = sec - minSec;

    const harvestMoney = targetThreads.harvestMoney;
    const expectedValue = expectedValuePerRamSecond(ns, target);

    return {
        name: target,
        harvestMoney,
        expectedValue,
        hckLevel,
        maxMoney,
        moneyPercent,
        secPlus,
        threadsH: targetThreads.h,
        threadsG: targetThreads.g,
        threadsW: targetThreads.w
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
    ns: NS,
    title: string,
    phase: SortBy,
    setTableSorting: (column: string) => void,
    theme: UserInterfaceTheme,
}

export function ServerBlock({ ns, title, phase, setTableSorting, theme }: IBlockSettings) {
    const cellStyle = { padding: "0 0.5em" };
    return (<>
        <h2>{title} - {phase.data.length} targets</h2>
        <table>
            <thead>
                <tr>
                    <th style={cellStyle}><Header sortedBy={phase} setTableSorting={setTableSorting} field={"name"}>target</Header></th>
                    <th style={cellStyle}><Header sortedBy={phase} setTableSorting={setTableSorting} field={"harvestMoney"}>$/s</Header></th>
                    <th style={cellStyle}><Header sortedBy={phase} setTableSorting={setTableSorting} field={"expectedValue"}>E($/GBs)</Header></th>
                    <th style={cellStyle}><Header sortedBy={phase} setTableSorting={setTableSorting} field={"hckLevel"}>lvl</Header></th>
                    <th style={cellStyle}><Header sortedBy={phase} setTableSorting={setTableSorting} field={"maxMoney"}>$</Header></th>
                    <th style={cellStyle}><Header sortedBy={phase} setTableSorting={setTableSorting} field={"moneyPercent"}>⌈$⌉%</Header></th>
                    <th style={cellStyle}><Header sortedBy={phase} setTableSorting={setTableSorting} field={"secPlus"}>+sec</Header></th>
                    <th style={cellStyle}><Header sortedBy={phase} setTableSorting={setTableSorting} field={"threadsH"}>thr(h)</Header></th>
                    <th style={cellStyle}><Header sortedBy={phase} setTableSorting={setTableSorting} field={"threadsG"}>thr(g)</Header></th>
                    <th style={cellStyle}><Header sortedBy={phase} setTableSorting={setTableSorting} field={"threadsW"}>thr(w)</Header></th>
                </tr>
            </thead>
            {phase.data.map((target, idx) => <ServerRow ns={ns} host={target} theme={theme} rowIndex={idx} cellStyle={cellStyle}></ServerRow>)}
        </table>
    </>);
}

interface IHeaderSettings {
    children?: any,
    field: string,
    sortedBy: SortBy,
    setTableSorting: (column: string) => void,
}

function Header({ children, field, sortedBy, setTableSorting }: IHeaderSettings) {
    const dir = sortedBy.dir;
    let decB = (<></>);
    let decA = (<></>);
    if (sortedBy.key === field) {
        let arrow = (sortedBy.dir === Dir.Asc ? "⮝" : "⮟");
        decB = <DecB arrow={arrow} />;
        decA = <DecA arrow={arrow} />;
    }
    return <a href="#" onClick={() => setTableSorting(field)}>{decB}{children}{decA}</a>;
}

interface IDecSettings {
    arrow: string,
}

function DecB({ arrow }: IDecSettings) {
    return (<span>{arrow}&nbsp;</span>);
}

function DecA({ arrow }: IDecSettings) {
    return (<span>&nbsp;{arrow}</span>);
}

interface IRowSettings {
    ns: NS,
    host: HostInfo,
    rowIndex: number,
    cellStyle: any,
    theme: UserInterfaceTheme,
}

function ServerRow({ ns, host, rowIndex, cellStyle, theme }: IRowSettings) {
    return (
        <tr key={host.name} style={rowIndex % 2 === 1 ? undefined : { backgroundColor: theme.well }}>
            <td style={cellStyle}>{host.name}</td>
            <td style={cellStyle}>{`$${ns.formatNumber(host.harvestMoney, 2)}`}</td>
            <td style={cellStyle}>{`$${ns.formatNumber(host.expectedValue, 2)}`}</td>
            <td style={cellStyle}>{`${ns.formatNumber(host.hckLevel, 0, 1000000, true)}`}</td>
            <td style={cellStyle}>{`$${ns.formatNumber(host.maxMoney, 2)}`}</td>
            <td style={cellStyle}>{formatPercent(ns, host.moneyPercent)}</td>
            <td style={cellStyle}>{formatSecurity(ns, host.secPlus)}</td>
            <td style={cellStyle}>{formatThreads(ns, host.threadsH)}</td>
            <td style={cellStyle}>{formatThreads(ns, host.threadsG)}</td>
            <td style={cellStyle}>{formatThreads(ns, host.threadsW)}</td>
        </tr>
    );
}

function formatPercent(ns: NS, value: number) {
    return Math.abs(value - 1) < 0.001 ? '100.0%' : ns.formatPercent(value);
}

function formatSecurity(ns: NS, sec: number) {
    return Math.abs(sec) < 0.1 ? '+0.0' : `+${ns.formatNumber(sec, 2)}`;
}
