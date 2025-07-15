import type { NS, NetscriptPort } from "netscript";

import {
    DISCOVERY_PORT,
    DISCOVERY_RESPONSE_PORT,
    Message,
    MessageType,
    Subscription as ClientSubscription,
} from "services/client/discover";
import { MemoryClient } from "services/client/memory";

import { CONFIG } from "services/config";

import { trySendMessage } from "util/client";
import { readAllFromPort } from "util/ports";
import { walkNetworkBFS } from "util/walk";


export async function main(ns: NS) {
    ns.disableLog("sleep");

    const cracked = new Set<string>();

    const discovery = new Discovery(ns);
    discovery.pushHosts(["home"]);

    const memClient = new MemoryClient(ns);

    const self = ns.self();
    memClient.registerAllocation(self.server, self.ramUsage, 1);

    const port = ns.getPortHandle(DISCOVERY_PORT);
    const respPort = ns.getPortHandle(DISCOVERY_RESPONSE_PORT);

    let messageWaiting = true;
    port.nextWrite().then(() => { messageWaiting = true; });

    const walkRate = 1000 * 5;
    let lastWalk = 0;

    while (true) {
        if (lastWalk + walkRate < Date.now()) {
            const network = walkNetworkBFS(ns);
            const newHosts: string[] = [];
            for (const host of network.keys()) {
                if (host === "home") continue;

                if (!cracked.has(host)) {
                    if (ns.hasRootAccess(host)) {
                        newHosts.push(host);
                        cracked.add(host);
                    } else {
                        const portsNeeded = ns.getServerNumPortsRequired(host);
                        if (countPortCrackers(ns) >= portsNeeded) {
                            attemptCrack(ns, host);
                            if (ns.hasRootAccess(host)) {
                                newHosts.push(host);
                                cracked.add(host);
                            }
                        }
                    }
                }
            }
            if (newHosts.length > 0) {
                discovery.pushHosts(newHosts);
            }
            lastWalk = Date.now();
        }

        if (messageWaiting) {
            messageWaiting = false;
            port.nextWrite().then(() => { messageWaiting = true; });
            await readRequests(ns, port, respPort, discovery);
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
                if (subscription && validSubscription) {
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
    missedUpdates: string[];
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
            if (this.ns.getServerMaxRam(host) > 0 && !this._workers.has(host)) {
                this._workers.add(host);
                newWorkers.push(host);
            }

            if (this.ns.getServerMaxMoney(host) > 0 && !this._targets.has(host)) {
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

function registerSubscriber(ns: NS, subscription: ClientSubscription, subscriptions: Subscription[]) {
    const existingSubscription = subscriptions.find(sub => sub.port === subscription.port);
    if (existingSubscription) {
        // Assume that subscriptions with the same port are for
        // the same service.
        ns.print(
            `WARN: replacing subscription for port ${subscription.port}. `
            + `Old: ${existingSubscription.messageType} `
            + `New: ${subscription.messageType}`
        );
        existingSubscription.messageType = subscription.messageType;
        existingSubscription.failedNotifications = 0;
    } else {
        subscriptions.push({
            failedNotifications: 0,
            missedUpdates: [],
            ...subscription
        } as Subscription);
    }
}

function notifySubscriptions(ns: NS, hosts: string[], subscriptions: Subscription[]) {
    for (const sub of subscriptions) {
        let hostsToSend = [...sub.missedUpdates, ...hosts];
        if (trySendMessage(ns.getPortHandle(sub.port), sub.messageType, hostsToSend)) {
            // Reset failed notifications when we succeed in sending them
            sub.failedNotifications = 0;
            sub.missedUpdates = [];
        } else {
            ns.print(`WARN: failed to send message ${sub.messageType} to port ${sub.port}`);
            // We retry a failing subscription a configurable number
            // of times
            sub.failedNotifications += 1;
            extend(sub.missedUpdates, hosts);
        }
    }
}

/** Efficiently extend `array` with the given `values`. */
function extend<T>(array: T[], values: T[]): T[] {
    var l2 = values.length;

    if (l2 === 0)
        return array;

    var l1 = array.length;

    array.length += l2;

    for (var i = 0; i < l2; i++)
        array[l1 + i] = values[i];

    return array;
};
