import type { NS } from "netscript";

import { HOSTS_BY_PORTS_REQUIRED, TARGETS_BY_PORTS_REQUIRED } from "all-hosts";

import { SOFTEN_PORT } from "util/ports";

const HACKING_FILES = [
    "/util/ports.js",
    "/all-hosts.js",
    "/batch/soften.js",
    "/batch/build.js",
    "/batch/steal.js"
];

export async function main(ns: NS) {
    let portsCracked = 0;
    let softenPort = ns.getPortHandle(SOFTEN_PORT);

    while (portsCracked < 5) {
        let numCrackers = countPortCrackers(ns);

        for (let i = portsCracked; i < 6 && i <= numCrackers; i++) {
            const hosts = HOSTS_BY_PORTS_REQUIRED[i];
            for (const host of hosts) {
                crackHost(ns, host, i);

                // SCP all hacking files appropriate to that amount of memory
                ns.scp(HACKING_FILES, host, 'home');

                // Write host name to the soften port
                softenPort.write(host);
            }

            const targets = TARGETS_BY_PORTS_REQUIRED[i];
            for (const target of targets) {
                crackHost(ns, target, i);

                // Write host name to the soften port
                softenPort.write(target);
            }
        }
        portsCracked = numCrackers;
        await ns.sleep(1000);
    }
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
