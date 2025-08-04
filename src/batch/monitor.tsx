import type {
    AutocompleteData,
    NetscriptPort,
    NS,
    UserInterfaceTheme,
} from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

import {
    MONITOR_PORT,
    Lifecycle,
    Message as MonitorMessage,
} from 'batch/client/monitor';

import {
    expectedValuePerRamSecond,
    harvestBatchEndingPeriod,
    harvestProfit,
} from 'batch/expected_value';
import { CONFIG } from 'batch/config';

import { DiscoveryClient } from 'services/client/discover';
import { ALLOC_ID_ARG } from 'services/client/memory_tag';
import { TaskSelectorClient } from 'batch/client/task_selector';

import { MoneyTracker, primedMoneyTracker } from 'util/money-tracker';

import { extend } from 'util/extend';
import { readAllFromPort, readLoop } from 'util/ports';
import { HUD_HEIGHT, HUD_WIDTH, STATUS_WINDOW_WIDTH } from 'util/ui';
import { sleep } from 'util/time';

const FLAGS = [
    ['refreshrate', 200],
    ['help', false],
] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    const rest = flags._ as string[];
    if (
        rest.length !== 0
        || flags.help
        || typeof flags.refreshrate != 'number'
    ) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

Visualize server status and hacking profits.

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --refreshrate  Time to sleep between refreshes
  --help         Show this help message

CONFIGURATION
  BATCH_maxHackPercent  Max percent hacked when estimating profit
`);
        return;
    }

    ns.disableLog('ALL');
    ns.clearLog();
    ns.ui.openTail();
    ns.ui.setTailTitle('Monitor');
    ns.ui.resizeTail(HUD_WIDTH, HUD_HEIGHT);

    const [ww] = ns.ui.windowSize();
    ns.ui.moveTail(ww - (HUD_WIDTH + STATUS_WINDOW_WIDTH), 0);

    const tableSortings: Record<string, SortBy> = {
        harvesting: {
            key: 'hckLevel',
            dir: Dir.Desc,
            data: [],
        },
        pendingHarvesting: {
            key: 'hckLevel',
            dir: Dir.Desc,
            data: [],
        },
        sowing: {
            key: 'hckLevel',
            dir: Dir.Desc,
            data: [],
        },
        pendingSowing: {
            key: 'hckLevel',
            dir: Dir.Desc,
            data: [],
        },
        tilling: {
            key: 'hckLevel',
            dir: Dir.Desc,
            data: [],
        },
        pendingTilling: {
            key: 'hckLevel',
            dir: Dir.Desc,
            data: [],
        },
    };

    function setTableSorting(table: string, sortBy: string) {
        if (tableSortings[table].key == sortBy) {
            tableSortings[table].dir =
                tableSortings[table].dir === Dir.Asc ? Dir.Desc : Dir.Asc;
        } else {
            tableSortings[table].key = sortBy;
            tableSortings[table].dir = Dir.Desc;
        }
    }

    const openTailQueue: number[] = [];

    function queuePidsForTail(pids: number[]) {
        extend(openTailQueue, pids);
    }

    const monitorPort = ns.getPortHandle(MONITOR_PORT);

    const discoveryClient = new DiscoveryClient(ns);
    const taskSelectorClient = new TaskSelectorClient(ns);

    const workers = await discoveryClient.requestWorkers({
        messageType: Lifecycle.Worker,
        port: MONITOR_PORT,
    });
    const snapshot = await taskSelectorClient.requestLifecycle();

    const lifecycleByHost: Map<string, Lifecycle> = new Map(snapshot);

    readLoop(ns, monitorPort, async () =>
        readMonitorMessages(ns, monitorPort, workers, lifecycleByHost),
    );

    const moneyTracker: MoneyTracker = await primedMoneyTracker(ns, 3, 1000);

    function getTableSortings(ns: NS) {
        const threadsByTarget = countThreadsByTarget(
            ns,
            workers,
            Array.from(lifecycleByHost.keys()),
        );

        tableSortings.harvesting.data = [];
        tableSortings.pendingHarvesting.data = [];
        tableSortings.sowing.data = [];
        tableSortings.pendingSowing.data = [];
        tableSortings.tilling.data = [];
        tableSortings.pendingTilling.data = [];

        for (const [host, phase] of lifecycleByHost.entries()) {
            if (
                host === 'home'
                || host.startsWith('pserv')
                || ns.getServerMaxMoney(host) <= 0
            )
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

        return tableSortings;
    }

    while (true) {
        const theme = ns.ui.getTheme();
        const tableSortings = getTableSortings(ns);
        const hackMoneyPerSec = moneyTracker.velocity('hacking');

        ns.clearLog();
        ns.printRaw(
            <>
                <ServerBlock
                    ns={ns}
                    queuePidsForTail={queuePidsForTail}
                    title={'Harvesting'}
                    phase={tableSortings.harvesting}
                    setTableSorting={setTableSorting.bind(null, 'harvesting')}
                    theme={theme}
                    moneyPerSec={hackMoneyPerSec}
                ></ServerBlock>
                <ServerBlock
                    ns={ns}
                    queuePidsForTail={queuePidsForTail}
                    title={'Pending Harvesting'}
                    phase={tableSortings.pendingHarvesting}
                    setTableSorting={setTableSorting.bind(
                        null,
                        'pendingHarvesting',
                    )}
                    theme={theme}
                ></ServerBlock>
                <ServerBlock
                    ns={ns}
                    queuePidsForTail={queuePidsForTail}
                    title={'Sowing'}
                    phase={tableSortings.sowing}
                    setTableSorting={setTableSorting.bind(null, 'sowing')}
                    theme={theme}
                ></ServerBlock>
                <ServerBlock
                    ns={ns}
                    queuePidsForTail={queuePidsForTail}
                    title={'Pending Sowing'}
                    phase={tableSortings.pendingSowing}
                    setTableSorting={setTableSorting.bind(
                        null,
                        'pendingSowing',
                    )}
                    theme={theme}
                ></ServerBlock>
                <ServerBlock
                    ns={ns}
                    queuePidsForTail={queuePidsForTail}
                    title={'Tilling'}
                    phase={tableSortings.tilling}
                    setTableSorting={setTableSorting.bind(null, 'tilling')}
                    theme={theme}
                ></ServerBlock>
                <ServerBlock
                    ns={ns}
                    queuePidsForTail={queuePidsForTail}
                    title={'Pending Tilling'}
                    phase={tableSortings.pendingTilling}
                    setTableSorting={setTableSorting.bind(
                        null,
                        'pendingTilling',
                    )}
                    theme={theme}
                ></ServerBlock>
            </>,
        );
        ns.ui.renderTail();

        for (const pid of openTailQueue) {
            ns.ui.openTail(pid);
        }
        // Clear the queue after we process it
        openTailQueue.length = 0;
        await sleep(flags.refreshrate);
    }
}

enum Dir {
    Asc,
    Desc,
}

interface SortBy {
    key: string;
    dir: Dir;
    data: HostInfo[];
}

function readMonitorMessages(
    ns: NS,
    monitorPort: NetscriptPort,
    workers: string[],
    lifecycleByHost: Map<string, Lifecycle>,
) {
    for (const nextMsg of readAllFromPort(ns, monitorPort)) {
        if (typeof nextMsg === 'object') {
            const [phase, reqId, payload] = nextMsg as MonitorMessage;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const _ = reqId; // Minimize code surface where lint is suppressed
            const hosts = Array.isArray(payload) ? payload : [payload];
            for (const host of hosts) {
                if (phase === Lifecycle.Worker) {
                    if (!workers.includes(host)) {
                        workers.push(host);
                    }
                } else {
                    lifecycleByHost.set(host, phase);
                }
            }
        }
    }
}

function sortByFn(sortBy: SortBy) {
    const sortKey = sortBy.key;
    if (sortBy.dir === Dir.Desc) {
        return (a: HostInfo, b: HostInfo) => {
            if (sortKey === 'name') {
                return b.name.localeCompare(a.name);
            } else {
                return b[sortKey] - a[sortKey];
            }
        };
    } else {
        return (a: HostInfo, b: HostInfo) => {
            if (sortKey === 'name') {
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
    tillPids: number[];

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
        this.tillPids = [];
    }
}

export function countThreadsByTarget(
    ns: NS,
    workers: string[],
    targets: string[],
): Map<string, TargetThreads> {
    const targetThreads = new Map(targets.map((h) => [h, new TargetThreads()]));

    for (const worker of workers) {
        for (const pi of ns.ps(worker)) {
            const target =
                pi.args[0] === ALLOC_ID_ARG ? pi.args[2] : pi.args[0];

            if (typeof target != 'string') continue;

            const targetThread = targetThreads.get(target);
            if (!targetThread) {
                continue;
            }

            if (pi.filename === 'batch/harvest.js') {
                targetThread.harvestPids.push(pi.pid);
                targetThread.harvestMoney = ns.getScriptIncome(
                    pi.filename,
                    worker,
                    ...pi.args,
                );
            } else if (pi.filename === 'batch/sow.js') {
                targetThread.sowPids.push(pi.pid);
            } else if (pi.filename === 'batch/till.js') {
                targetThread.tillPids.push(pi.pid);
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
    name: string;

    pids: number[];

    harvestMoney: number;
    expectedProfit: number;
    expectedValue: number;
    hckLevel: number;
    maxMoney: number;
    moneyPercent: number;
    secPlus: number;
    threadsH: number;
    threadsG: number;
    threadsW: number;
};

export function hostInfo(
    ns: NS,
    target: string,
    targetThreads: TargetThreads,
): HostInfo {
    const pids = [
        ...targetThreads.harvestPids,
        ...targetThreads.sowPids,
        ...targetThreads.tillPids,
    ];

    let hckLevel = ns.getServerRequiredHackingLevel(target);
    hckLevel = typeof hckLevel == 'number' && !isNaN(hckLevel) ? hckLevel : 1;
    const minSec = ns.getServerMinSecurityLevel(target);
    const sec = ns.getServerSecurityLevel(target);

    const maxMoney = ns.getServerMaxMoney(target);
    const moneyPercent = moneyPercentage(ns, target);
    const secPlus = sec - minSec;

    const harvestMoney = targetThreads.harvestMoney;
    const expectedProfit = harvestProfit(
        ns,
        target,
        CONFIG.maxHackPercent,
        harvestBatchEndingPeriod(),
    );
    const expectedValue = expectedValuePerRamSecond(
        ns,
        target,
        CONFIG.maxHackPercent,
    );

    return {
        name: target,
        pids,

        harvestMoney,
        expectedProfit,
        expectedValue,
        hckLevel,
        maxMoney,
        moneyPercent,
        secPlus,
        threadsH: targetThreads.h,
        threadsG: targetThreads.g,
        threadsW: targetThreads.w,
    };
}

function moneyPercentage(ns: NS, host: string): number {
    const curMoney = ns.getServerMoneyAvailable(host);
    const maxMoney = ns.getServerMaxMoney(host);
    return maxMoney != 0 ? curMoney / maxMoney : 0.0;
}

function formatThreads(ns: NS, threads: number): string {
    if (threads < 1) {
        return '';
    }

    return ns.formatNumber(threads, 2, 1000, true);
}

interface IBlockSettings {
    ns: NS;
    title: string;
    phase: SortBy;
    setTableSorting: (column: string) => void;
    queuePidsForTail: (pids: number[]) => void;
    theme: UserInterfaceTheme;
    moneyPerSec?: number;
}

export function ServerBlock({
    ns,
    title,
    phase,
    setTableSorting,
    queuePidsForTail,
    theme,
    moneyPerSec,
}: IBlockSettings) {
    const cellStyle = { padding: '0 0.5em' };
    return (
        <>
            <h2>
                {title} - {phase.data.length} targets
                {moneyPerSec !== undefined
                    ? ` for $${ns.formatNumber(moneyPerSec)}/s`
                    : ''}
            </h2>
            <table>
                <thead>
                    <tr>
                        <th style={cellStyle}>
                            <Header
                                sortedBy={phase}
                                setTableSorting={setTableSorting}
                                field={'name'}
                            >
                                target
                            </Header>
                        </th>
                        <th style={cellStyle}>
                            <Header
                                sortedBy={phase}
                                setTableSorting={setTableSorting}
                                field={'harvestMoney'}
                            >
                                $/s
                            </Header>
                        </th>
                        <th style={cellStyle}>
                            <Header
                                sortedBy={phase}
                                setTableSorting={setTableSorting}
                                field={'expectedProfit'}
                            >
                                E($/s)
                            </Header>
                        </th>
                        <th style={cellStyle}>
                            <Header
                                sortedBy={phase}
                                setTableSorting={setTableSorting}
                                field={'expectedValue'}
                            >
                                E($/GBs)
                            </Header>
                        </th>
                        <th style={cellStyle}>
                            <Header
                                sortedBy={phase}
                                setTableSorting={setTableSorting}
                                field={'hckLevel'}
                            >
                                lvl
                            </Header>
                        </th>
                        <th style={cellStyle}>
                            <Header
                                sortedBy={phase}
                                setTableSorting={setTableSorting}
                                field={'maxMoney'}
                            >
                                $
                            </Header>
                        </th>
                        <th style={cellStyle}>
                            <Header
                                sortedBy={phase}
                                setTableSorting={setTableSorting}
                                field={'moneyPercent'}
                            >
                                ⌈$⌉%
                            </Header>
                        </th>
                        <th style={cellStyle}>
                            <Header
                                sortedBy={phase}
                                setTableSorting={setTableSorting}
                                field={'secPlus'}
                            >
                                +sec
                            </Header>
                        </th>
                        <th style={cellStyle}>
                            <Header
                                sortedBy={phase}
                                setTableSorting={setTableSorting}
                                field={'threadsH'}
                            >
                                thr(h)
                            </Header>
                        </th>
                        <th style={cellStyle}>
                            <Header
                                sortedBy={phase}
                                setTableSorting={setTableSorting}
                                field={'threadsG'}
                            >
                                thr(g)
                            </Header>
                        </th>
                        <th style={cellStyle}>
                            <Header
                                sortedBy={phase}
                                setTableSorting={setTableSorting}
                                field={'threadsW'}
                            >
                                thr(w)
                            </Header>
                        </th>
                    </tr>
                </thead>
                {phase.data.map((target, idx) => (
                    <ServerRow
                        ns={ns}
                        host={target}
                        theme={theme}
                        queuePidsForTail={queuePidsForTail}
                        rowIndex={idx}
                        cellStyle={cellStyle}
                    ></ServerRow>
                ))}
            </table>
        </>
    );
}

interface IHeaderSettings {
    children?: string;
    field: string;
    sortedBy: SortBy;
    setTableSorting: (column: string) => void;
}

function Header({
    children,
    field,
    sortedBy,
    setTableSorting,
}: IHeaderSettings) {
    let decB = <></>;
    let decA = <></>;
    if (sortedBy.key === field) {
        const arrow = sortedBy.dir === Dir.Asc ? '⮝' : '⮟';
        decB = <DecB arrow={arrow} />;
        decA = <DecA arrow={arrow} />;
    }
    return (
        <a href="#" onClick={() => setTableSorting(field)}>
            {decB}
            {children}
            {decA}
        </a>
    );
}

interface IDecSettings {
    arrow: string;
}

function DecB({ arrow }: IDecSettings) {
    return <span>{arrow}&nbsp;</span>;
}

function DecA({ arrow }: IDecSettings) {
    return <span>&nbsp;{arrow}</span>;
}

interface IRowSettings {
    ns: NS;
    host: HostInfo;
    rowIndex: number;
    cellStyle: object;
    queuePidsForTail: (pids: number[]) => void;
    theme: UserInterfaceTheme;
}

function ServerRow({
    ns,
    host,
    rowIndex,
    cellStyle,
    queuePidsForTail,
    theme,
}: IRowSettings) {
    return (
        <tr
            key={host.name}
            style={
                rowIndex % 2 === 1 ? undefined : { backgroundColor: theme.well }
            }
        >
            <td style={cellStyle}>
                <Hostname
                    host={host}
                    theme={theme}
                    queuePidsForTail={queuePidsForTail}
                />
            </td>
            <td style={cellStyle}>
                {`$${ns.formatNumber(host.harvestMoney, 2)}`}
            </td>
            <td style={cellStyle}>
                {`$${ns.formatNumber(host.expectedProfit, 2)}`}
            </td>
            <td style={cellStyle}>
                {`$${ns.formatNumber(host.expectedValue, 2)}`}
            </td>
            <td style={cellStyle}>
                {`${ns.formatNumber(host.hckLevel, 0, 1000000, true)}`}
            </td>
            <td style={cellStyle}>{`$${ns.formatNumber(host.maxMoney, 2)}`}</td>
            <td style={cellStyle}>{formatPercent(ns, host.moneyPercent)}</td>
            <td style={cellStyle}>{formatSecurity(ns, host.secPlus)}</td>
            <td style={cellStyle}>{formatThreads(ns, host.threadsH)}</td>
            <td style={cellStyle}>{formatThreads(ns, host.threadsG)}</td>
            <td style={cellStyle}>{formatThreads(ns, host.threadsW)}</td>
        </tr>
    );
}

interface IHostnameSettings {
    host: HostInfo;
    queuePidsForTail: (pids: number[]) => void;
    theme: UserInterfaceTheme;
}

function Hostname({ host, queuePidsForTail, theme }: IHostnameSettings) {
    return (
        <a
            style={{ color: theme.primarylight }}
            href="#"
            onClick={() => queuePidsForTail(host.pids)}
        >
            {host.name}
        </a>
    );
}

function formatPercent(ns: NS, value: number) {
    return Math.abs(value - 1) < 0.001 ? '100.0%' : ns.formatPercent(value);
}

function formatSecurity(ns: NS, sec: number) {
    return ns.sprintf('%+6.2f', sec);
}
