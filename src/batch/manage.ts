import type { NS, ProcessInfo } from "netscript";

import { HostMsg, WorkerType, TargetType, HOSTS_PORT, HOSTS_DONE, EMPTY_SENTINEL } from "util/ports";

declare const React: any;

export async function main(ns: NS) {
    ns.disableLog('sleep');
    ns.tail();

    let hostsPort = ns.getPortHandle(HOSTS_PORT);

    let workers = new Map();

    let targets = [];

    while (true) {
        let nextMsg = hostsPort.read();
        // Check for empty value
        if (typeof nextMsg === "string" && nextMsg === EMPTY_SENTINEL) {
            let keepGoing = true;
            hostsPort.nextWrite().then(_ => keepGoing = false);

            while (keepGoing) {
                manageWorkers(ns, workers, targets);
                await ns.sleep(100);
            }
            continue;
        }

        // Check for the done sentinel value
        if (nextMsg === HOSTS_DONE) {
            break;
        }

        receiveHost(ns, nextMsg, workers, targets);

        await ns.sleep(100);
    }

    while (true) {
        manageWorkers(ns, workers, targets);
        await ns.sleep(100);
    }
}

function manageWorkers(ns: NS, workers: Map<string, Worker>, targets: Target[]) { }

function receiveHost(ns: NS, nextMsg: any, workers: Map<string, Worker>, targets: Target[]) {
    if (typeof nextMsg === "object") {
        let nextHostMsg = nextMsg as HostMsg;
        ns.printf("new %s: %s", nextHostMsg.type, nextHostMsg.host);
        switch (nextHostMsg.type) {
            case WorkerType:
                workers.set(nextHostMsg.host, new Worker(ns, nextHostMsg.host));
                break;
            case TargetType:
                targets.push(new Target(ns, nextHostMsg.host));
                break;
        }
    }
}

class Worker {
    ns: NS;
    name: string;
    maxRam: number;
    scripts: ProcessInfo[];

    constructor(ns: NS, host: string) {
        this.ns = ns;
        this.name = host;
        this.maxRam = ns.getServerMaxRam(host);
        this.scripts = ns.ps(host);
    }
}

class Target {
    ns: NS;
    name: string;
    maxMoney: number;
    minSec: number;

    constructor(ns: NS, host: string) {
        this.ns = ns;
        this.name = host;
        this.maxMoney = ns.getServerMaxMoney(host);
        this.minSec = ns.getServerMinSecurityLevel(host);
    }
}
