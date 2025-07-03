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

    const discovered = new Set<string>();
    const cracked = new Set<string>();
    const workers = new Set<string>();
    const targets = new Set<string>();

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

                if (!discovered.has(host)) {
                    discovered.add(host);
                }

                if (!cracked.has(host)) {
                    if (ns.hasRootAccess(host)) {
                        await registerHost(ns, host, managerClient, memClient, monitorClient, workers, targets);
                        cracked.add(host);
                    } else {
                        const portsNeeded = ns.getServerNumPortsRequired(host);
                        if (countPortCrackers(ns) >= portsNeeded) {
                            attemptCrack(ns, host);
                            if (ns.hasRootAccess(host)) {
                                await registerHost(ns, host, managerClient, memClient, monitorClient, workers, targets);
                                cracked.add(host);
                            }
                        }
                    }
                }
            }
            lastWalk = Date.now();
        }

        if (messageWaiting) {
            await readRequests(ns, port, respPort, workers, targets);
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
    workers: Set<string>,
    targets: Set<string>,
) {
    if (ns.getServerMaxRam(host) > 0) {
        workers.add(host);
        await mem.newWorker(host);
        await mon.worker(host);
    }
    if (ns.getServerMaxMoney(host) > 0) {
        targets.add(host);
        await mgr.newTarget(host);
    }
}

async function readRequests(
    ns: NS,
    port: NetscriptPort,
    respPort: NetscriptPort,
    workers: Set<string>,
    targets: Set<string>,
) {
    for (const next of readAllFromPort(ns, port)) {
        const msg = next as Message;
        const requestId = msg[1] as string;
        let payload: any = null;
        switch (msg[0]) {
            case MessageType.RequestWorkers:
                payload = Array.from(workers);
                break;
            case MessageType.RequestTargets:
                payload = Array.from(targets);
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
