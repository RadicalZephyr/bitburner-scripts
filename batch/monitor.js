import { parseFlags } from 'util/flags';
import { MONITOR_PORT, MONITOR_RESPONSE_PORT, Lifecycle, MonitorProtocol, } from 'batch/client/monitor';
import { expectedValuePerRamSecond, harvestBatchEndingPeriod, harvestProfit, } from 'batch/expected_value';
import { CONFIG } from 'batch/config';
import { DiscoveryClient } from 'services/client/discover';
import { ALLOC_ID_ARG } from 'services/client/memory_tag';
import { TaskSelectorClient } from 'batch/client/task_selector';
import { primedMoneyTracker } from 'util/money-tracker';
import { HUD_HEIGHT, HUD_WIDTH, STATUS_WINDOW_WIDTH } from 'ui/constants';
import { extend } from 'util/extend';
import { BaseServer } from 'util/protocol';
import { UI_CONFIG } from 'ui/config';
import { useNsUpdate, usePoll, useTheme } from 'ui/hooks';
import { React } from 'lib/react';
const FLAGS = [
    ['refreshrate', 200],
    ['help', false],
];
export function autocomplete(data) {
    data.flags(FLAGS);
    return [];
}
export async function main(ns) {
    const flags = await parseFlags(ns, FLAGS);
    const rest = flags._;
    if (rest.length !== 0
        || flags.help
        || typeof flags.refreshrate != 'number') {
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
    if (UI_CONFIG.openHUD) {
        ns.ui.openTail();
        ns.ui.setTailTitle('Monitor');
        ns.ui.resizeTail(HUD_WIDTH, HUD_HEIGHT);
        const [ww] = ns.ui.windowSize();
        ns.ui.moveTail(ww - (HUD_WIDTH + STATUS_WINDOW_WIDTH), 0);
    }
    const tableSortings = {
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
    function setTableSorting(table, sortBy) {
        if (tableSortings[table].key == sortBy) {
            tableSortings[table].dir =
                tableSortings[table].dir === Dir.Asc ? Dir.Desc : Dir.Asc;
        }
        else {
            tableSortings[table].key = sortBy;
            tableSortings[table].dir = Dir.Desc;
        }
    }
    const openTailQueue = [];
    function queuePidsForTail(pids) {
        extend(openTailQueue, pids);
    }
    const discoveryClient = new DiscoveryClient(ns);
    const taskSelectorClient = new TaskSelectorClient(ns);
    const workers = await discoveryClient.requestWorkers({
        messageType: Lifecycle.Worker,
        port: MONITOR_PORT,
    });
    const snapshot = await taskSelectorClient.requestLifecycle();
    const lifecycleByHost = new Map(snapshot);
    const server = new Server(ns, workers, lifecycleByHost);
    void server.readLoop();
    const moneyTracker = await primedMoneyTracker(ns, 3, 1000);
    function getTableSortings(ns) {
        const threadsByTarget = countThreadsByTarget(ns, workers, Array.from(lifecycleByHost.keys()));
        tableSortings.harvesting.data = [];
        tableSortings.pendingHarvesting.data = [];
        tableSortings.sowing.data = [];
        tableSortings.pendingSowing.data = [];
        tableSortings.tilling.data = [];
        tableSortings.pendingTilling.data = [];
        for (const [host, phase] of lifecycleByHost.entries()) {
            const targetThreads = threadsByTarget.get(host);
            if (host === 'home'
                || host.startsWith('pserv')
                || ns.getServerMaxMoney(host) <= 0
                || targetThreads == undefined)
                continue;
            const info = hostInfo(ns, host, targetThreads);
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
        for (const phaseName of TableKey) {
            const phase = tableSortings[phaseName];
            const sortKey = phase.key;
            const phaseTargets = phase.data ?? [];
            if (phaseTargets.length > 0 && phaseTargets[0][sortKey])
                phaseTargets.sort(sortByFn(phase));
        }
        return { ...tableSortings };
    }
    function getHackMoneyPerSec() {
        return moneyTracker.velocity('hacking');
    }
    ns.clearLog();
    ns.printRaw(React.createElement(Monitor, { ns: ns, getHackMoneyPerSec: getHackMoneyPerSec, getTableSortings: getTableSortings, setTableSorting: setTableSorting, queuePidsForTail: queuePidsForTail }));
    ns.ui.renderTail();
    while (true) {
        for (const pid of openTailQueue.splice(0)) {
            ns.ui.openTail(pid);
        }
        await ns.asleep(flags.refreshrate);
    }
}
class Server extends BaseServer {
    constructor(ns, workers, lifecycleByHost) {
        const requestPort = ns.getPortHandle(MONITOR_PORT);
        const responsePort = ns.getPortHandle(MONITOR_RESPONSE_PORT);
        const handleHosts = (payload, fn) => {
            const hosts = Array.isArray(payload) ? payload : [payload];
            for (const host of hosts)
                fn(host);
            return Promise.resolve();
        };
        const handlers = {
            [Lifecycle.Worker]: (payload) => handleHosts(payload, (host) => {
                if (!workers.includes(host))
                    workers.push(host);
            }),
            [Lifecycle.PendingTilling]: (payload) => handleHosts(payload, (host) => lifecycleByHost.set(host, Lifecycle.PendingTilling)),
            [Lifecycle.Tilling]: (payload) => handleHosts(payload, (host) => lifecycleByHost.set(host, Lifecycle.Tilling)),
            [Lifecycle.PendingSowing]: (payload) => handleHosts(payload, (host) => lifecycleByHost.set(host, Lifecycle.PendingSowing)),
            [Lifecycle.Sowing]: (payload) => handleHosts(payload, (host) => lifecycleByHost.set(host, Lifecycle.Sowing)),
            [Lifecycle.PendingHarvesting]: (payload) => handleHosts(payload, (host) => lifecycleByHost.set(host, Lifecycle.PendingHarvesting)),
            [Lifecycle.Harvesting]: (payload) => handleHosts(payload, (host) => lifecycleByHost.set(host, Lifecycle.Harvesting)),
            [Lifecycle.Rebalancing]: (payload) => handleHosts(payload, (host) => lifecycleByHost.set(host, Lifecycle.Rebalancing)),
        };
        super(ns, MonitorProtocol, requestPort, responsePort, handlers);
    }
}
var Dir;
(function (Dir) {
    Dir[Dir["Asc"] = 0] = "Asc";
    Dir[Dir["Desc"] = 1] = "Desc";
})(Dir || (Dir = {}));
const TableKey = [
    'harvesting',
    'pendingHarvesting',
    'sowing',
    'pendingSowing',
    'tilling',
    'pendingTilling',
];
function sortByFn(sortBy) {
    const sortKey = sortBy.key;
    if (sortBy.dir === Dir.Desc) {
        return (a, b) => {
            if (sortKey === 'name') {
                return b.name.localeCompare(a.name);
            }
            else {
                const aKey = a[sortKey];
                const bKey = b[sortKey];
                return bKey - aKey;
            }
        };
    }
    else {
        return (a, b) => {
            if (sortKey === 'name') {
                return a.name.localeCompare(b.name);
            }
            else {
                return a[sortKey] - b[sortKey];
            }
        };
    }
}
export class TargetThreads {
    h;
    hPid;
    g;
    gPid;
    w;
    wPid;
    harvestMoney;
    harvestPids;
    sowPids;
    tillPids;
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
export function countThreadsByTarget(ns, workers, targets) {
    const targetThreads = new Map(targets.map((h) => [h, new TargetThreads()]));
    for (const worker of workers) {
        for (const pi of ns.ps(worker)) {
            const target = pi.args[0] === ALLOC_ID_ARG ? pi.args[2] : pi.args[0];
            if (typeof target != 'string')
                continue;
            const targetThread = targetThreads.get(target);
            if (!targetThread) {
                continue;
            }
            if (pi.filename === 'batch/harvest.js') {
                targetThread.harvestPids.push(pi.pid);
                targetThread.harvestMoney = ns.getScriptIncome(pi.filename, worker, ...pi.args);
            }
            else if (pi.filename === 'batch/sow.js') {
                targetThread.sowPids.push(pi.pid);
            }
            else if (pi.filename === 'batch/till.js') {
                targetThread.tillPids.push(pi.pid);
            }
            else if (pi.filename === 'batch/h.js') {
                targetThread.hPid.push(pi.pid);
                targetThread.h += pi.threads;
            }
            else if (pi.filename === 'batch/g.js') {
                targetThread.gPid.push(pi.pid);
                targetThread.g += pi.threads;
            }
            else if (pi.filename === 'batch/w.js') {
                targetThread.wPid.push(pi.pid);
                targetThread.w += pi.threads;
            }
        }
    }
    return targetThreads;
}
export function hostInfo(ns, target, targetThreads) {
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
    const expectedProfit = harvestProfit(ns, target, CONFIG.maxHackPercent, harvestBatchEndingPeriod());
    const expectedValue = expectedValuePerRamSecond(ns, target, CONFIG.maxHackPercent);
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
function moneyPercentage(ns, host) {
    const curMoney = ns.getServerMoneyAvailable(host);
    const maxMoney = ns.getServerMaxMoney(host);
    return maxMoney != 0 ? curMoney / maxMoney : 0.0;
}
function formatThreads(ns, threads) {
    if (threads < 1) {
        return '';
    }
    return ns.formatNumber(threads, 2, 1000, true);
}
function Monitor({ ns, getHackMoneyPerSec, getTableSortings, setTableSorting, queuePidsForTail, }) {
    const theme = useTheme(ns);
    const hackMoneyPerSec = usePoll(ns, 1000, getHackMoneyPerSec);
    const tableSortings = useNsUpdate(ns, 100, getTableSortings);
    return (React.createElement(React.Fragment, null,
        React.createElement(ServerBlock, { ns: ns, queuePidsForTail: queuePidsForTail, title: 'Harvesting', phase: tableSortings.harvesting, setTableSorting: bindTableSorting(setTableSorting, 'harvesting'), theme: theme, moneyPerSec: hackMoneyPerSec }),
        React.createElement(ServerBlock, { ns: ns, queuePidsForTail: queuePidsForTail, title: 'Pending Harvesting', phase: tableSortings.pendingHarvesting, setTableSorting: bindTableSorting(setTableSorting, 'pendingHarvesting'), theme: theme }),
        React.createElement(ServerBlock, { ns: ns, queuePidsForTail: queuePidsForTail, title: 'Sowing', phase: tableSortings.sowing, setTableSorting: bindTableSorting(setTableSorting, 'sowing'), theme: theme }),
        React.createElement(ServerBlock, { ns: ns, queuePidsForTail: queuePidsForTail, title: 'Pending Sowing', phase: tableSortings.pendingSowing, setTableSorting: bindTableSorting(setTableSorting, 'pendingSowing'), theme: theme }),
        React.createElement(ServerBlock, { ns: ns, queuePidsForTail: queuePidsForTail, title: 'Tilling', phase: tableSortings.tilling, setTableSorting: bindTableSorting(setTableSorting, 'tilling'), theme: theme }),
        React.createElement(ServerBlock, { ns: ns, queuePidsForTail: queuePidsForTail, title: 'Pending Tilling', phase: tableSortings.pendingTilling, setTableSorting: bindTableSorting(setTableSorting, 'pendingTilling'), theme: theme })));
}
function bindTableSorting(setTableSorting, tableName) {
    return setTableSorting.bind(null, tableName);
}
export function ServerBlock({ ns, title, phase, setTableSorting, queuePidsForTail, theme, moneyPerSec, }) {
    const cellStyle = { padding: '0 0.5em' };
    return (React.createElement(React.Fragment, null,
        React.createElement("h2", null,
            title,
            " - ",
            phase.data.length,
            " targets",
            moneyPerSec !== undefined
                ? ` for $${ns.formatNumber(moneyPerSec)}/s`
                : ''),
        React.createElement("table", null,
            React.createElement("thead", null,
                React.createElement("tr", null,
                    React.createElement("th", { style: cellStyle },
                        React.createElement(Header, { sortedBy: phase, setTableSorting: setTableSorting, field: 'name' }, "target")),
                    React.createElement("th", { style: cellStyle },
                        React.createElement(Header, { sortedBy: phase, setTableSorting: setTableSorting, field: 'harvestMoney' }, "$/s")),
                    React.createElement("th", { style: cellStyle },
                        React.createElement(Header, { sortedBy: phase, setTableSorting: setTableSorting, field: 'expectedProfit' }, "E($/s)")),
                    React.createElement("th", { style: cellStyle },
                        React.createElement(Header, { sortedBy: phase, setTableSorting: setTableSorting, field: 'expectedValue' }, "E($/GBs)")),
                    React.createElement("th", { style: cellStyle },
                        React.createElement(Header, { sortedBy: phase, setTableSorting: setTableSorting, field: 'hckLevel' }, "lvl")),
                    React.createElement("th", { style: cellStyle },
                        React.createElement(Header, { sortedBy: phase, setTableSorting: setTableSorting, field: 'maxMoney' }, "$")),
                    React.createElement("th", { style: cellStyle },
                        React.createElement(Header, { sortedBy: phase, setTableSorting: setTableSorting, field: 'moneyPercent' }, "\u2308$\u2309%")),
                    React.createElement("th", { style: cellStyle },
                        React.createElement(Header, { sortedBy: phase, setTableSorting: setTableSorting, field: 'secPlus' }, "+sec")),
                    React.createElement("th", { style: cellStyle },
                        React.createElement(Header, { sortedBy: phase, setTableSorting: setTableSorting, field: 'threadsH' }, "thr(h)")),
                    React.createElement("th", { style: cellStyle },
                        React.createElement(Header, { sortedBy: phase, setTableSorting: setTableSorting, field: 'threadsG' }, "thr(g)")),
                    React.createElement("th", { style: cellStyle },
                        React.createElement(Header, { sortedBy: phase, setTableSorting: setTableSorting, field: 'threadsW' }, "thr(w)")))),
            phase.data.map((target, idx) => (React.createElement(ServerRow, { ns: ns, host: target, theme: theme, queuePidsForTail: queuePidsForTail, rowIndex: idx, cellStyle: cellStyle }))))));
}
function Header({ children, field, sortedBy, setTableSorting, }) {
    let decB = React.createElement(React.Fragment, null);
    let decA = React.createElement(React.Fragment, null);
    if (sortedBy.key === field) {
        const arrow = sortedBy.dir === Dir.Asc ? '⮝' : '⮟';
        decB = React.createElement(DecB, { arrow: arrow });
        decA = React.createElement(DecA, { arrow: arrow });
    }
    return (React.createElement("a", { href: "#", onClick: () => setTableSorting(field) },
        decB,
        children,
        decA));
}
function DecB({ arrow }) {
    return React.createElement("span", null,
        arrow,
        "\u00A0");
}
function DecA({ arrow }) {
    return React.createElement("span", null,
        "\u00A0",
        arrow);
}
function ServerRow({ ns, host, rowIndex, cellStyle, queuePidsForTail, theme, }) {
    return (React.createElement("tr", { key: host.name, style: rowIndex % 2 === 1 ? undefined : { backgroundColor: theme.well } },
        React.createElement("td", { style: cellStyle },
            React.createElement(Hostname, { host: host, theme: theme, queuePidsForTail: queuePidsForTail })),
        React.createElement("td", { style: cellStyle }, `$${ns.formatNumber(host.harvestMoney, 2)}`),
        React.createElement("td", { style: cellStyle }, `$${ns.formatNumber(host.expectedProfit, 2)}`),
        React.createElement("td", { style: cellStyle }, `$${ns.formatNumber(host.expectedValue, 2)}`),
        React.createElement("td", { style: cellStyle }, `${ns.formatNumber(host.hckLevel, 0, 1000000, true)}`),
        React.createElement("td", { style: cellStyle }, `$${ns.formatNumber(host.maxMoney, 2)}`),
        React.createElement("td", { style: cellStyle }, formatPercent(ns, host.moneyPercent)),
        React.createElement("td", { style: cellStyle }, formatSecurity(ns, host.secPlus)),
        React.createElement("td", { style: cellStyle }, formatThreads(ns, host.threadsH)),
        React.createElement("td", { style: cellStyle }, formatThreads(ns, host.threadsG)),
        React.createElement("td", { style: cellStyle }, formatThreads(ns, host.threadsW))));
}
function Hostname({ host, queuePidsForTail, theme }) {
    return (React.createElement("a", { style: { color: theme.primarylight }, href: "#", onClick: () => queuePidsForTail(host.pids) }, host.name));
}
function formatPercent(ns, value) {
    return Math.abs(value - 1) < 0.001 ? '100.0%' : ns.formatPercent(value);
}
function formatSecurity(ns, sec) {
    return ns.sprintf('%+6.2f', sec);
}
