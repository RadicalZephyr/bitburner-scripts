import type { NS } from "netscript";

import { HOSTS_BY_PORTS_REQUIRED, TARGETS_BY_PORTS_REQUIRED } from "all-hosts";

import { HOSTS_PORT, HOSTS_DONE, workerMsg, targetMsg } from "util/ports";

const HACKING_FILES = [
    "/all-hosts.js",
    "/util/ports.js",
    "/util/wait.js",
    "/batch/till.js",
    "/batch/sow.js",
    "/batch/harvest.js",
    "/batch/h.js",
    "/batch/g.js",
    "/batch/w.js"
];

export async function main(ns: NS) {
    let portsCracked = 0;
    let hostsPort = ns.getPortHandle(HOSTS_PORT);

    while (portsCracked < 5) {
        let numCrackers = countPortCrackers(ns);

        for (let i = portsCracked; i < 6 && i <= numCrackers; i++) {
            const hosts = HOSTS_BY_PORTS_REQUIRED[i];
            for (const host of hosts) {
                // Skip n00dles because that's probably where this
                // script is running.
                if (host === "n00dles") {
                    continue;
                }

                crackHost(ns, host, i);

                // SCP all hacking files appropriate to that amount of memory
                ns.scp(HACKING_FILES, host, 'home');

                // Write host name to the worker and till ports
                hostsPort.write(workerMsg(host));
            }

            const targets = TARGETS_BY_PORTS_REQUIRED[i];
            for (const target of targets) {
                crackHost(ns, target, i);

                // Write host name to the till port
                hostsPort.write(targetMsg(target));
            }
        }
        portsCracked = numCrackers;
        await ns.sleep(1000);
    }
    // Signal that the last worker has been sent.
    hostsPort.write(HOSTS_DONE);
}

function crackHost(ns: NS, host: string, ports: number): void {
    let crackers = portOpeningProgramFns(ns);
    for (let i = 0; i < ports; i++) {
        crackers[i].fn(host);
    }
    ns.nuke(host);
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
