import type { NS, NetscriptPort } from "netscript";

import { ManagerClient } from "batch/client/manage";
import { MonitorClient } from "batch/client/monitor";

import { MemoryClient } from "services/client/memory";
import {
    DISCOVERY_PORT,
    DISCOVERY_RESPONSE_PORT,
    Message,
    MessageType,
} from "services/client/discover";

import { walkNetworkBFS } from "util/walk";
import { readAllFromPort } from "util/ports";


export async function main(ns: NS) {
    ns.disableLog("sleep");

    const cracked = new Set<string>();

    const discovery = new Discovery(ns);

    const managerClient = new ManagerClient(ns);
    const memClient = new MemoryClient(ns);
    const monitorClient = new MonitorClient(ns);

    const port = ns.getPortHandle(DISCOVERY_PORT);
    const respPort = ns.getPortHandle(DISCOVERY_RESPONSE_PORT);

    let messageWaiting = true;
    port.nextWrite().then(() => { messageWaiting = true; });

    const walkRate = 1000 * 5;
    let lastWalk = Date.now();

    while (true) {
        if (lastWalk + walkRate < Date.now()) {
            const network = walkNetworkBFS(ns);
            for (const host of network.keys()) {
                if (host === "home") continue;

                if (!cracked.has(host)) {
                    if (ns.hasRootAccess(host)) {
                        await registerHost(ns, host, managerClient, memClient, monitorClient, discovery);
                        cracked.add(host);
                    } else {
                        const portsNeeded = ns.getServerNumPortsRequired(host);
                        if (countPortCrackers(ns) >= portsNeeded) {
                            attemptCrack(ns, host);
                            if (ns.hasRootAccess(host)) {
                                await registerHost(ns, host, managerClient, memClient, monitorClient, discovery);
                                cracked.add(host);
                            }
                        }
                    }
                }
            }
            lastWalk = Date.now();
        }

        if (messageWaiting) {
            await readRequests(ns, port, respPort, discovery);
            messageWaiting = false;
            port.nextWrite().then(() => { messageWaiting = true; });
        }

        await ns.sleep(50);
    }
}

async function registerHost(
    ns: NS,
    host: string,
    mgr: ManagerClient,
    mem: MemoryClient,
    mon: MonitorClient,
    discovery: Discovery,
) {
    discovery.pushHost(host);
    if (ns.getServerMaxRam(host) > 0) {
        await mem.newWorker(host);
        await mon.worker(host);
    }
    if (ns.getServerMaxMoney(host) > 0) {
        await mgr.newTarget(host);
    }
}

async function readRequests(
    ns: NS,
    port: NetscriptPort,
    respPort: NetscriptPort,
    discovery: Discovery,
) {
    for (const next of readAllFromPort(ns, port)) {
        const msg = next as Message;
        const requestId = msg[1] as string;
        let payload: any = null;
        switch (msg[0]) {
            case MessageType.RequestWorkers:
                payload = discovery.workers;
                break;
            case MessageType.RequestTargets:
                payload = discovery.targets;
                break;
        }
        while (!respPort.tryWrite([requestId, payload])) {
            await ns.sleep(20);
        }
    }
}

type CrackProgramFn = (host: string) => void;

type CrackProgram = {
    file: string,
    fn: CrackProgramFn,
};

function portOpeningProgramFns(ns: NS): CrackProgram[] {
    return [
        { file: "BruteSSH.exe", fn: ns.brutessh.bind(ns) },
        { file: "FTPCrack.exe", fn: ns.ftpcrack.bind(ns) },
        { file: "relaySMTP.exe", fn: ns.relaysmtp.bind(ns) },
        { file: "HTTPWorm.exe", fn: ns.httpworm.bind(ns) },
        { file: "SQLInject.exe", fn: ns.sqlinject.bind(ns) },
    ];
}

function countPortCrackers(ns: NS): number {
    return portOpeningProgramFns(ns)
        .filter(p => ns.fileExists(p.file, "home"))
        .length;
}

function attemptCrack(ns: NS, host: string) {
    for (const prog of portOpeningProgramFns(ns)) {
        if (ns.fileExists(prog.file, "home")) {
            prog.fn(host);
        }
    }
    ns.nuke(host);
}

class Discovery {
    ns: NS;

    _workers: Set<string>;
    _targets: Set<string>;

    constructor(ns: NS) {
        this.ns = ns;

        this._workers = new Set();
        this._targets = new Set();
    }

    pushHost(host: string) {
        if (this.ns.getServerMaxRam(host) > 0) {
            this._workers.add(worker);
        }

        if (this.ns.getServerMaxMoney(host) > 0) {
            this._targets.add(target);
        }
    }

    get workers(): string[] {
        return Array.from(this._workers);
    }

    get targets(): string[] {
        return Array.from(this._targets);
    }
}
