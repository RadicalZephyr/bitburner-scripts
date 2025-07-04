import type { NS, NetscriptPort } from "netscript";

import {
    DISCOVERY_PORT,
    DISCOVERY_RESPONSE_PORT,
    Message,
    MessageType,
    Subscription as ClientSubscription,
} from "services/client/discover";

import { trySendMessage } from "util/client";
import { readAllFromPort } from "util/ports";
import { walkNetworkBFS } from "util/walk";
import { CONFIG } from "./config";


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
            const newlyCracked: string[] = [];
            for (const host of network.keys()) {
                if (host === "home") continue;

                if (!cracked.has(host)) {
                    if (ns.hasRootAccess(host)) {
                        newlyCracked.push(host);
                        cracked.add(host);
                    } else {
                        const portsNeeded = ns.getServerNumPortsRequired(host);
                        if (countPortCrackers(ns) >= portsNeeded) {
                            attemptCrack(ns, host);
                            if (ns.hasRootAccess(host)) {
                                newlyCracked.push(host);
                                cracked.add(host);
                            }
                        }
                    }
                }
            }
            if (newlyCracked.length > 0) {
                discovery.pushHosts(newlyCracked);
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

function isValidSubscription(subscription?: ClientSubscription): boolean {
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

interface Subscription extends ClientSubscription {
    failedNotifications: number;
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

    pushHosts(hosts: string[]) {
        const newWorkers: string[] = [];
        const newTargets: string[] = [];

        for (const host of hosts) {
            if (this.ns.getServerMaxRam(host) > 0) {
                this._workers.add(host);
                newWorkers.push(host);
            }

            if (this.ns.getServerMaxMoney(host) > 0) {
                this._targets.add(host);
                newTargets.push(host);
            }
        }

        if (newWorkers.length > 0) {
            notifySubscriptions(this.ns, newWorkers, this.workerSubscriptions);
            this.workerSubscriptions = this.workerSubscriptions.filter(sub => sub.failedNotifications < CONFIG.subscriptionMaxRetries);
        }

        if (newTargets.length > 0) {
            notifySubscriptions(this.ns, newTargets, this.targetSubscriptions);
            this.targetSubscriptions = this.targetSubscriptions.filter(sub => sub.failedNotifications < CONFIG.subscriptionMaxRetries);
        }
    }

    registerWorkerSubscriber(subscription: ClientSubscription) {
        registerSubscriber(this.ns, subscription, this.workerSubscriptions);
    }

    registerTargetSubscriber(subscription: ClientSubscription) {
        registerSubscriber(this.ns, subscription, this.targetSubscriptions);
    }

    get workers(): string[] {
        return Array.from(this._workers);
    }

    get targets(): string[] {
        return Array.from(this._targets);
    }
}

function registerSubscriber(ns: NS, subscription: ClientSubscription, subscriptions: ClientSubscription[]) {
    const existingSubscription = subscriptions.find(sub => sub.port === subscription.port);
    if (existingSubscription) {
        // Assume that subscriptions with the same port are for
        // the same service.
        ns.print(
            `WARN: replacing subscription for port ${subscription.port}. `
            + `Old: ${existingSubscription.messageType} `
            + `New: ${subscription.messageType}`
        );
    } else {
        subscriptions.push({ failedNotifications: 0, ...subscription } as Subscription);
    }
}

function notifySubscriptions(ns: NS, hosts: string[], subscriptions: Subscription[]) {
    for (const sub of subscriptions) {
        if (trySendMessage(ns.getPortHandle(sub.port), sub.messageType, hosts)) {
            // Reset failed notifications when we succeed in sending them
            sub.failedNotifications = 0;
        } else {
            ns.print("WARN: failed to send message ${sub.messageType} to port ${sub.port}")
            // We retry a failing subscription a configurable number
            // of times
            sub.failedNotifications += 1;
        }
    }
}
