import type { NS } from "netscript";

import { walkNetworkBFS } from "util/walk";

import { ManagerClient } from "batch/client/manage";
import { MemoryClient } from "batch/client/memory";
import { MonitorClient } from "batch/client/monitor";


export async function main(ns: NS) {
    ns.disableLog("sleep");

    const discovered = new Set<string>();
    const cracked = new Set<string>();

    const managerClient = new ManagerClient(ns);
    const memClient = new MemoryClient(ns);
    const monitorClient = new MonitorClient(ns);

    while (true) {
        const network = walkNetworkBFS(ns);
        for (const host of network.keys()) {
            if (host === "home") continue;

            if (!discovered.has(host)) {
                discovered.add(host);
            }

            if (!cracked.has(host)) {
                if (ns.hasRootAccess(host)) {
                    await registerHost(ns, host, managerClient, memClient, monitorClient);
                    cracked.add(host);
                } else {
                    const portsNeeded = ns.getServerNumPortsRequired(host);
                    if (countPortCrackers(ns) >= portsNeeded) {
                        attemptCrack(ns, host);
                        if (ns.hasRootAccess(host)) {
                            await registerHost(ns, host, managerClient, memClient, monitorClient);
                            cracked.add(host);
                        }
                    }
                }
            }
        }

        await ns.sleep(5000);
    }
}

async function registerHost(ns: NS, host: string, mgr: ManagerClient, mem: MemoryClient, mon: MonitorClient) {
    if (ns.getServerMaxRam(host) > 0) {
        await mem.newWorker(host);
        await mon.worker(host);
    }
    if (ns.getServerMaxMoney(host) > 0) {
        await mgr.newTarget(host);
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
