import type { NS } from "netscript";

import { HOSTS_BY_PORTS_REQUIRED } from "all-hosts";

const HACKING_FILES = [
    "/util/ports.js",
    "/all-hosts.js",
    "/batch/soften.js",
    "/batch/build.js",
    "/batch/steal.js"
];

export async function main(ns: NS) {
    let numCrackers = countPortCrackers(ns);

    let crackedHosts: [string, number][] = [];
    for (let i = 0; i < 6 && i <= numCrackers; i++) {
        const hosts = HOSTS_BY_PORTS_REQUIRED[i];
        for (const host of hosts) {
            crackHost(ns, host[0], i);
            crackedHosts.push(host);
        }
    }

    ns.tprintf("cracked hosts: %s", JSON.stringify(crackedHosts.map((h) => h[0])));

    for (const host of crackedHosts) {
        // SCP all hacking files appropriate to that amount of memory
        ns.scp(HACKING_FILES, host[0], 'home');
    }
}

function crackHost(ns: NS, host: string, ports: number): void {
    let crackers = portOpeningProgramFns(ns);
    for (let i = 0; i < ports - 1; i++) {
        crackers[i].fn(host);
    }
    ns.nuke(host);
}

function countPortCrackers(ns: NS): number {
    let crackers = portOpeningProgramFns(ns);
    let numCrackers = 0;
    for (const c of crackers) {
        if (ns.fileExists(c.file)) {
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
