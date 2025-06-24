import type { NS } from "netscript";

import { HOSTS_BY_PORTS_REQUIRED, TARGETS_BY_PORTS_REQUIRED } from "all-hosts";

import { ManagerClient } from "batch/client/manage";

import { MemoryClient } from "batch/client/memory";

const HACKING_FILES = [
    "/all-hosts.js",
    "/batch/client/manage.js",
    "/batch/client/memory.js",
    "/util/ports.js",
    "/util/wait.js",
    "/batch/till.js",
    "/batch/sow.js",
    "/batch/harvest.js",
    "/batch/h.js",
    "/batch/g.js",
    "/batch/w.js"
];

const NUKED_FILE = "nuked.js";

export async function main(ns: NS) {
    ns.disableLog("ALL");
    ns.clearLog();

    let portsCracked = 0;
    let memoryClient = new MemoryClient(ns);
    let managerClient = new ManagerClient(ns)

    ns.write(NUKED_FILE, "export const NUKED = true;", "w");

    while (portsCracked < 5) {
        let numCrackers = countPortCrackers(ns);

        if (numCrackers == portsCracked) {
            await ns.sleep(1000);
            continue;
        }
        ns.printf("numCrackers: %s\nportsCracked = %s\n", numCrackers, portsCracked);
        for (let i = portsCracked; i < 6 && i <= numCrackers; i++) {
            ns.printf("portsCracked = %s\n", portsCracked);
            const hosts = HOSTS_BY_PORTS_REQUIRED[i];
            for (const host of hosts) {
                ns.printf("cracking host %s", host);
                // Skip n00dles because that's probably where this
                // script is running.
                if (host === "n00dles") {
                    continue;
                }

                crackHost(ns, host, i);

                // SCP all hacking files appropriate to that amount of memory
                ns.scp(HACKING_FILES, host, 'home');

                // Notify the MemoryManager there's a new worker available
                await memoryClient.newWorker(host);
            }

            const targets = TARGETS_BY_PORTS_REQUIRED[i];
            for (const target of targets) {
                ns.printf("cracking target %s", target);
                crackHost(ns, target, i);

                // Write host name to the targets port
                managerClient.newTarget(target);
            }
            portsCracked = i;
        }
        portsCracked = numCrackers;
        await ns.sleep(1000);
    }
}

/**
 * Attempt to crack a host. Returns true if the host was actually
   cracked, false if it was already cracked when this function was
   called.
 */
function crackHost(ns: NS, host: string, ports: number): boolean {
    if (ns.fileExists(NUKED_FILE, host)) {
        return false
    }
    let crackers = portOpeningProgramFns(ns);
    for (const cracker of crackers) {
        if (ns.fileExists(cracker.file)) {
            cracker.fn(host);
        }
    }
    ns.nuke(host);
    ns.scp(NUKED_FILE, host);
    return true;
}

function countPortCrackers(ns: NS): number {
    let crackers = portOpeningProgramFns(ns);
    let numCrackers = 0;
    for (const c of crackers) {
        if (ns.fileExists(c.file, "home")) {
            numCrackers += 1;
        }
    }
    return numCrackers;
}

type CrackProgramFn = (host: string) => void;

type CrackProgram = {
    file: string,
    fn: CrackProgramFn
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
