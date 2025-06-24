import type { NS } from "netscript";

import { ALL_HOSTS } from "all-hosts";
import { readAllFromPort, MONITOR_PORT } from "util/ports";
import { Lifecycle, Message as MonitorMessage } from "./client/monitor";

declare const React: any;

export async function main(ns: NS) {
    const flags = ns.flags([
        ['refreshrate', 200],
        ['help', false],
    ]);

    const rest = flags._ as string[];
    if (rest.length !== 0 || flags.help || typeof flags.refreshrate != 'number') {
        ns.tprint(`USAGE: run ${ns.getScriptName()}

        This script helps visualize the money and security of all servers.

        OPTIONS
        --refreshrate   Time to sleep between refreshing server data

        Example:

        > run ${ns.getScriptName()}
`);
        return;
    }
    ns.disableLog('ALL');
    ns.clearLog();
    ns.ui.openTail();
    ns.ui.resizeTail(800, 30 * 12);
    ns.ui.moveTail(720, 35);

    const monitorPort = ns.getPortHandle(MONITOR_PORT);
    const lifecycleByHost: Map<string, Lifecycle> = new Map();
    let monitorMessagesWaiting = true;

    while (true) {
        if (monitorMessagesWaiting) {
            for (const nextMsg of readAllFromPort(ns, monitorPort)) {
                if (typeof nextMsg === "object") {
                    const [phase, host] = nextMsg as MonitorMessage;
                    lifecycleByHost.set(host, phase);
                }
            }
            monitorMessagesWaiting = false;
            monitorPort.nextWrite().then(_ => { monitorMessagesWaiting = true; });
        }

        let threadsByTarget = countThreadsByTarget(ns);
        const harvesting: HostInfo[] = [];
        const sowing: HostInfo[] = [];
        const tilling: HostInfo[] = [];
        const pending: HostInfo[] = [];

        for (const host of ALL_HOSTS) {
            const phase = lifecycleByHost.get(host) ?? Lifecycle.Pending;
            const info = hostInfo(ns, host, threadsByTarget.get(host), phase);
            switch (phase) {
                case Lifecycle.Harvesting:
                    harvesting.push(info);
                    break;
                case Lifecycle.Sowing:
                    sowing.push(info);
                    break;
                case Lifecycle.Tilling:
                    tilling.push(info);
                    break;
                default:
                    pending.push(info);
                    break;
            }
        }

        ns.clearLog();
        ns.printRaw(<>
            <ServerBlock title={"Harvesting"} targets={harvesting}></ServerBlock>
            <ServerBlock title={"Sowing"} targets={sowing}></ServerBlock>
            <ServerBlock title={"Tilling"} targets={tilling}></ServerBlock>
            <ServerBlock title={"Pending"} targets={pending}></ServerBlock>
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

    mMoney: number;
    milking: boolean;
    mPid: number[];

    building: boolean;
    bPid: number[];

    constructor() {
        this.h = 0;
        this.hPid = [];

        this.g = 0;
        this.gPid = [];

        this.w = 0;
        this.wPid = [];

        this.mMoney = 0;
        this.milking = false;
        this.mPid = [];

        this.building = false;
        this.bPid = [];
    }
}

export function countThreadsByTarget(ns: NS): Map<string, TargetThreads> {
    let purchasedServers = ns.getPurchasedServers();
    let hosts = [...ALL_HOSTS, ...purchasedServers];
    let targetThreads = new Map(hosts.map(h => [h, new TargetThreads()]));

    for (const host of hosts) {
        for (const pi of ns.ps(host)) {

            let target = pi.args[0];

            if (typeof target != 'string') continue;

            let targetThread = targetThreads.get(target);

            if (pi.filename === '/batch/harvest.js') {
                targetThread.milking = true;
                targetThread.mPid.push(pi.pid);
                targetThread.mMoney = ns.getScriptIncome(pi.filename, host, ...pi.args);
            } else if (pi.filename === '/batch/sow.js') {
                targetThread.building = true;
                targetThread.bPid.push(pi.pid);
            } else if (pi.filename === '/batch/h.js') {
                targetThread.hPid.push(pi.pid);
                targetThread.h += pi.threads;
            } else if (pi.filename === '/batch/g.js') {
                targetThread.gPid.push(pi.pid);
                targetThread.g += pi.threads;
            } else if (pi.filename === '/batch/w.js') {
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
    moneyPerLevel: string,
    hckLevel: string,
    maxMoney: string,
    moneyPercent: string
    secPlus: string,
    threadsH: string,
    threadsG: string,
    threadsW: string
}

export function hostInfo(ns: NS, target: string, targetThreads: TargetThreads, lifecycle?: Lifecycle): HostInfo {
    const hckLevel = ns.getServerRequiredHackingLevel(target);
    const minSec = ns.getServerMinSecurityLevel(target);
    const sec = ns.getServerSecurityLevel(target);

    const money = ns.getServerMaxMoney(target);
    const moneyPercent = moneyPercentage(ns, target) * 100;
    const secPlus = sec - minSec;

    const milkMoney = targetThreads.mMoney;

    return {
        name: target,
        milkMoney: Math.abs(milkMoney) < 0 ? '' : "$" + ns.formatNumber(milkMoney, 2),
        moneyPerLevel: "$" + ns.formatNumber(money / hckLevel, 2),
        hckLevel: ns.formatNumber(hckLevel, 0, 1000000, true),
        maxMoney: "$" + ns.formatNumber(money, 2),
        moneyPercent: Math.abs(moneyPercent - 100) < 0.1 ? '100.0%' : ns.formatNumber(moneyPercent / 100, 2) + "%",
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
    title: string
    targets: HostInfo[]
}

export function ServerBlock({ title, targets }: IBlockSettings) {
    return (<>
        <h2>{title}</h2>
        <table>
            <thead>
                <tr>
                    <th>target</th>
                    <th>$/s</th>
                    <th>$/lvl</th>
                    <th>lvl</th>
                    <th>$</th>
                    <th>⌈$⌉%</th>
                    <th>+sec</th>
                    <th>thr(h)</th>
                    <th>thr(g)</th>
                    <th>thr(w)</th>
                </tr>
            </thead>
            {targets.map(target => <ServerRow host={target}></ServerRow>)}
        </table>
    </>);
}

interface IRowSettings {
    host: HostInfo
}

function ServerRow({ host }: IRowSettings) {
    return (
        <tr key={host.name}>
            <td>{host.name}</td>
            <td>{host.milkMoney}</td>
            <td>{host.moneyPerLevel}</td>
            <td>{host.hckLevel}</td>
            <td>{host.maxMoney}</td>
            <td>{host.moneyPercent}</td>
            <td>{host.secPlus}</td>
            <td>{host.threadsH}</td>
            <td>{host.threadsG}</td>
            <td>{host.threadsW}</td>
        </tr>
    );
}
