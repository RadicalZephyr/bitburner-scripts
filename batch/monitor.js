import { MONITOR_PORT, Lifecycle } from "batch/client/monitor";
import { expectedValuePerRamSecond } from "batch/expected_value";
import { DiscoveryClient } from "services/client/discover";
import { TaskSelectorClient } from "batch/client/task_selector";
import { registerAllocationOwnership } from "services/client/memory";
import { extend } from "util/extend";
import { readAllFromPort } from "util/ports";
export async function main(ns) {
    const flags = ns.flags([
        ['allocation-id', -1],
        ['refreshrate', 200],
        ['help', false],
    ]);
    const rest = flags._;
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
    ns.ui.setTailTitle("Monitor");
    ns.ui.resizeTail(930, 650);
    ns.ui.moveTail(1220, 0);
    const tableSortings = {
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
    function setTableSorting(table, sortBy) {
        if (tableSortings[table].key == sortBy) {
            tableSortings[table].dir = tableSortings[table].dir === Dir.Asc ? Dir.Desc : Dir.Asc;
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
    const monitorPort = ns.getPortHandle(MONITOR_PORT);
    const discoveryClient = new DiscoveryClient(ns);
    const taskSelectorClient = new TaskSelectorClient(ns);
    const workers = await discoveryClient.requestWorkers({ messageType: Lifecycle.Worker, port: MONITOR_PORT });
    const snapshot = await taskSelectorClient.requestLifecycle();
    const lifecycleByHost = new Map(snapshot);
    let monitorMessagesWaiting = true;
    while (true) {
        if (monitorMessagesWaiting) {
            monitorMessagesWaiting = false;
            monitorPort.nextWrite().then(_ => { monitorMessagesWaiting = true; });
            for (const nextMsg of readAllFromPort(ns, monitorPort)) {
                if (typeof nextMsg === "object") {
                    const [phase, _, payload] = nextMsg;
                    const hosts = Array.isArray(payload) ? payload : [payload];
                    for (const host of hosts) {
                        if (phase === Lifecycle.Worker) {
                            workers.push(host);
                        }
                        else {
                            lifecycleByHost.set(host, phase);
                        }
                    }
                }
            }
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
        ns.printRaw(React.createElement(React.Fragment, null,
            React.createElement(ServerBlock, { ns: ns, queuePidsForTail: queuePidsForTail, title: "Harvesting", phase: tableSortings.harvesting, setTableSorting: setTableSorting.bind(null, "harvesting"), theme: theme }),
            React.createElement(ServerBlock, { ns: ns, queuePidsForTail: queuePidsForTail, title: "Pending Harvesting", phase: tableSortings.pendingHarvesting, setTableSorting: setTableSorting.bind(null, "pendingHarvesting"), theme: theme }),
            React.createElement(ServerBlock, { ns: ns, queuePidsForTail: queuePidsForTail, title: "Sowing", phase: tableSortings.sowing, setTableSorting: setTableSorting.bind(null, "sowing"), theme: theme }),
            React.createElement(ServerBlock, { ns: ns, queuePidsForTail: queuePidsForTail, title: "Pending Sowing", phase: tableSortings.pendingSowing, setTableSorting: setTableSorting.bind(null, "pendingSowing"), theme: theme }),
            React.createElement(ServerBlock, { ns: ns, queuePidsForTail: queuePidsForTail, title: "Tilling", phase: tableSortings.tilling, setTableSorting: setTableSorting.bind(null, "tilling"), theme: theme }),
            React.createElement(ServerBlock, { ns: ns, queuePidsForTail: queuePidsForTail, title: "Pending Tilling", phase: tableSortings.pendingTilling, setTableSorting: setTableSorting.bind(null, "pendingTilling"), theme: theme })));
        ns.ui.renderTail();
        for (const pid of openTailQueue) {
            ns.ui.openTail(pid);
        }
        // Clear the queue after we process it
        openTailQueue.length = 0;
        await ns.sleep(flags.refreshrate);
    }
}
var Dir;
(function (Dir) {
    Dir[Dir["Asc"] = 0] = "Asc";
    Dir[Dir["Desc"] = 1] = "Desc";
})(Dir || (Dir = {}));
function sortByFn(sortBy) {
    const sortKey = sortBy.key;
    if (sortBy.dir === Dir.Desc) {
        return (a, b) => {
            if (sortKey === "name") {
                return b.name.localeCompare(a.name);
            }
            else {
                return b[sortKey] - a[sortKey];
            }
        };
    }
    else {
        return (a, b) => {
            if (sortKey === "name") {
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
    let targetThreads = new Map(targets.map(h => [h, new TargetThreads()]));
    for (const worker of workers) {
        for (const pi of ns.ps(worker)) {
            let target = pi.args[0] === "--allocation-id" ? pi.args[2] : pi.args[0];
            if (typeof target != 'string')
                continue;
            let targetThread = targetThreads.get(target);
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
        ...targetThreads.tillPids
    ];
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
        pids,
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
function moneyPercentage(ns, host) {
    const curMoney = ns.getServerMoneyAvailable(host);
    const maxMoney = ns.getServerMaxMoney(host);
    return maxMoney != 0.0 && maxMoney != -0.0 ? curMoney / maxMoney : 0.0;
}
function formatThreads(ns, threads) {
    if (threads < 1) {
        return '';
    }
    return ns.formatNumber(threads, 2, 1000, true);
}
export function ServerBlock({ ns, title, phase, setTableSorting, queuePidsForTail, theme }) {
    const cellStyle = { padding: "0 0.5em" };
    return (React.createElement(React.Fragment, null,
        React.createElement("h2", null,
            title,
            " - ",
            phase.data.length,
            " targets"),
        React.createElement("table", null,
            React.createElement("thead", null,
                React.createElement("tr", null,
                    React.createElement("th", { style: cellStyle },
                        React.createElement(Header, { sortedBy: phase, setTableSorting: setTableSorting, field: "name" }, "target")),
                    React.createElement("th", { style: cellStyle },
                        React.createElement(Header, { sortedBy: phase, setTableSorting: setTableSorting, field: "harvestMoney" }, "$/s")),
                    React.createElement("th", { style: cellStyle },
                        React.createElement(Header, { sortedBy: phase, setTableSorting: setTableSorting, field: "expectedValue" }, "E($/GBs)")),
                    React.createElement("th", { style: cellStyle },
                        React.createElement(Header, { sortedBy: phase, setTableSorting: setTableSorting, field: "hckLevel" }, "lvl")),
                    React.createElement("th", { style: cellStyle },
                        React.createElement(Header, { sortedBy: phase, setTableSorting: setTableSorting, field: "maxMoney" }, "$")),
                    React.createElement("th", { style: cellStyle },
                        React.createElement(Header, { sortedBy: phase, setTableSorting: setTableSorting, field: "moneyPercent" }, "\u2308$\u2309%")),
                    React.createElement("th", { style: cellStyle },
                        React.createElement(Header, { sortedBy: phase, setTableSorting: setTableSorting, field: "secPlus" }, "+sec")),
                    React.createElement("th", { style: cellStyle },
                        React.createElement(Header, { sortedBy: phase, setTableSorting: setTableSorting, field: "threadsH" }, "thr(h)")),
                    React.createElement("th", { style: cellStyle },
                        React.createElement(Header, { sortedBy: phase, setTableSorting: setTableSorting, field: "threadsG" }, "thr(g)")),
                    React.createElement("th", { style: cellStyle },
                        React.createElement(Header, { sortedBy: phase, setTableSorting: setTableSorting, field: "threadsW" }, "thr(w)")))),
            phase.data.map((target, idx) => React.createElement(ServerRow, { ns: ns, host: target, theme: theme, queuePidsForTail: queuePidsForTail, rowIndex: idx, cellStyle: cellStyle })))));
}
function Header({ children, field, sortedBy, setTableSorting }) {
    const dir = sortedBy.dir;
    let decB = (React.createElement(React.Fragment, null));
    let decA = (React.createElement(React.Fragment, null));
    if (sortedBy.key === field) {
        let arrow = (sortedBy.dir === Dir.Asc ? "⮝" : "⮟");
        decB = React.createElement(DecB, { arrow: arrow });
        decA = React.createElement(DecA, { arrow: arrow });
    }
    return React.createElement("a", { href: "#", onClick: () => setTableSorting(field) },
        decB,
        children,
        decA);
}
function DecB({ arrow }) {
    return (React.createElement("span", null,
        arrow,
        "\u00A0"));
}
function DecA({ arrow }) {
    return (React.createElement("span", null,
        "\u00A0",
        arrow));
}
function ServerRow({ ns, host, rowIndex, cellStyle, queuePidsForTail, theme }) {
    return (React.createElement("tr", { key: host.name, style: rowIndex % 2 === 1 ? undefined : { backgroundColor: theme.well } },
        React.createElement("td", { style: cellStyle },
            React.createElement(Hostname, { host: host, theme: theme, queuePidsForTail: queuePidsForTail })),
        React.createElement("td", { style: cellStyle }, `$${ns.formatNumber(host.harvestMoney, 2)}`),
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
    return Math.abs(sec) < 0.1 ? '+0.0' : `+${ns.formatNumber(sec, 2)}`;
}
