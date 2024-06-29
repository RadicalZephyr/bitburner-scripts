import type { NS } from "netscript";

import { HOSTS_BY_PORTS_REQUIRED } from "all-hosts";

export async function main(ns: NS) {
    let numCrackers = countPortCrackers(ns);

    let hostsCracked = [];
    for (let i = 0; i < 6 && i <= numCrackers; i++) {
        const hosts = HOSTS_BY_PORTS_REQUIRED[i];
        for (const host of hosts) {
            crackHost(ns, host[0], i);
            hostsCracked.push(host[0]);
        }
    }

    ns.tprintf("cracked hosts: %s", JSON.stringify(hostsCracked));
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
