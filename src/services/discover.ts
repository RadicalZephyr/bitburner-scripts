import type { NS, NetscriptPort } from "netscript";

import {
    DISCOVERY_PORT,
    DISCOVERY_RESPONSE_PORT,
    Message,
    MessageType,
    Subscription,
} from "services/client/discover";

import { trySendMessage } from "util/client";
import { readAllFromPort } from "util/ports";
import { walkNetworkBFS } from "util/walk";


export async function main(ns: NS) {
    ns.disableLog("sleep");

    const cracked = new Set<string>();

    const discovery = new Discovery(ns);

    const port = ns.getPortHandle(DISCOVERY_PORT);
    const respPort = ns.getPortHandle(DISCOVERY_RESPONSE_PORT);

    let messageWaiting = true;
    port.nextWrite().then(() => { messageWaiting = true; });

    const walkRate = 1000 * 5;
    let lastWalk = 0;

    while (true) {
        if (lastWalk + walkRate < Date.now()) {
            const network = walkNetworkBFS(ns);
            for (const host of network.keys()) {
                if (host === "home") continue;

                if (!cracked.has(host)) {
                    if (ns.hasRootAccess(host)) {
                        discovery.pushHost(host);
                        cracked.add(host);
                    } else {
                        const portsNeeded = ns.getServerNumPortsRequired(host);
                        if (countPortCrackers(ns) >= portsNeeded) {
                            attemptCrack(ns, host);
                            if (ns.hasRootAccess(host)) {
                                discovery.pushHost(host);
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

async function readRequests(
    ns: NS,
    port: NetscriptPort,
    respPort: NetscriptPort,
    discovery: Discovery,
) {
    for (const next of readAllFromPort(ns, port)) {
        const msg = next as Message;
        const requestId = msg[1] as string;

        if (typeof msg[2] !== "object" || msg[2] === null) {
            ns.print("ERROR: discovery received malformed request payload");
            continue;
        }

        const subscription = msg[2].pushUpdates;
        const validSubscription = isValidSubscription(subscription);

        let payload: any = null;
        switch (msg[0]) {
            case MessageType.RequestWorkers:
                if (subscription && validSubscription) {
                    discovery.registerWorkerSubscriber(subscription);
                }
                payload = discovery.workers;
                break;
            case MessageType.RequestTargets:
                if (subscription) {
                    discovery.registerTargetSubscriber(subscription);
                }
                payload = discovery.targets;
                break;
        }
        while (!respPort.tryWrite([requestId, payload])) {
            await ns.sleep(20);
        }
    }
}

function isValidSubscription(subscription?: Subscription): boolean {
    return subscription
        && typeof subscription === "object"
        && typeof subscription.messageType !== "undefined"
        && typeof subscription.port === "number";
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

    _workers: Set<string> = new Set();
    _targets: Set<string> = new Set();

    workerSubscriptions: Subscription[] = [];
    targetSubscriptions: Subscription[] = [];

    constructor(ns: NS) {
        this.ns = ns;
    }

    pushHost(host: string) {
        if (this.ns.getServerMaxRam(host) > 0) {
            this._workers.add(host);
            notifySubscriptions(this.ns, host, this.workerSubscriptions);
        }

        if (this.ns.getServerMaxMoney(host) > 0) {
            this._targets.add(host);
            notifySubscriptions(this.ns, host, this.targetSubscriptions);
        }
    }

    registerWorkerSubscriber(subscription: Subscription) {
        this.workerSubscriptions.push(subscription);
    }

    registerTargetSubscriber(subscription: Subscription) {
        this.targetSubscriptions.push(subscription);
    }

    get workers(): string[] {
        return Array.from(this._workers);
    }

    get targets(): string[] {
        return Array.from(this._targets);
    }
}

function notifySubscriptions(ns: NS, host: string, subscriptions: Subscription[]) {
    let remaining = [];
    for (const sub of subscriptions) {
        if (trySendMessage(ns.getPortHandle(sub.port), sub.messageType, host)) {
            remaining.push(sub);
        }
    }
}
