import type { NS } from '@ns';
import { FlagsSchema, parseFlags } from 'util/flags';

import {
    DISCOVERY_PORT,
    DISCOVERY_RESPONSE_PORT,
    MessageType,
    Subscription as ClientSubscription,
    DiscoverProtocolDef,
    DiscoverProtocol,
} from 'services/client/discover';
import { MemoryClient } from 'services/client/memory';

import { CONFIG } from 'services/config';
import { extend } from 'util/extend';
import { BaseServer, Handlers } from 'util/protocol';
import { walkNetworkBFS } from 'util/walk';

const FLAGS = [['help', false]] as const satisfies FlagsSchema;

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    if (flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

Daemon that discovers hosts and notifies subscribers.

OPTIONS
  --help   Show this help message

CONFIGURATION
  SERVICE_discoverWalkIntervalMs  Delay between network scans
  SERVICE_subscriptionMaxRetries  Failed notifications tolerated
`);
        return;
    }

    ns.disableLog('sleep');

    const cracked = new Set<string>();

    const discovery = new Discovery(ns);
    discovery.pushHosts(['home']);

    const memClient = new MemoryClient(ns);

    const self = ns.self();
    memClient.registerAllocation(self.server, self.ramUsage, 1);

    const server = new Server(ns, discovery);
    server.readLoop();

    while (true) {
        const network = walkNetworkBFS(ns);
        const newHosts: string[] = [];
        for (const host of network.keys()) {
            if (host === 'home') continue;

            if (cracked.has(host)) continue;

            if (ns.hasRootAccess(host)) {
                newHosts.push(host);
                cracked.add(host);
                continue;
            }

            const portsNeeded = ns.getServerNumPortsRequired(host);
            if (countPortCrackers(ns) < portsNeeded) continue;

            attemptCrack(ns, host);
            if (!ns.hasRootAccess(host)) continue;

            newHosts.push(host);
            cracked.add(host);
        }

        if (newHosts.length > 0) {
            discovery.pushHosts(newHosts);
        }

        await ns.asleep(CONFIG.discoverWalkIntervalMs);
    }
}

class Server extends BaseServer<DiscoverProtocolDef> {
    constructor(ns: NS, discovery: Discovery) {
        const requestPort = ns.getPortHandle(DISCOVERY_PORT);
        const responsePort = ns.getPortHandle(DISCOVERY_RESPONSE_PORT);
        const handlers: Handlers<DiscoverProtocolDef> = {
            [MessageType.RequestWorkers]: (request) => {
                if (request.pushUpdates)
                    discovery.registerWorkerSubscriber(request.pushUpdates);
                return Promise.resolve(discovery.workers);
            },
            [MessageType.RequestTargets]: (request) => {
                if (request.pushUpdates)
                    discovery.registerTargetSubscriber(request.pushUpdates);
                return Promise.resolve(discovery.targets);
            },
        };
        super(ns, DiscoverProtocol, requestPort, responsePort, handlers);
    }
}

type CrackProgramFn = (host: string) => void;

type CrackProgram = {
    file: string;
    fn: CrackProgramFn;
};

function portOpeningProgramFns(ns: NS): CrackProgram[] {
    return [
        { file: 'BruteSSH.exe', fn: ns.brutessh.bind(ns) },
        { file: 'FTPCrack.exe', fn: ns.ftpcrack.bind(ns) },
        { file: 'relaySMTP.exe', fn: ns.relaysmtp.bind(ns) },
        { file: 'HTTPWorm.exe', fn: ns.httpworm.bind(ns) },
        { file: 'SQLInject.exe', fn: ns.sqlinject.bind(ns) },
    ];
}

function countPortCrackers(ns: NS): number {
    return portOpeningProgramFns(ns).filter((p) =>
        ns.fileExists(p.file, 'home'),
    ).length;
}

function attemptCrack(ns: NS, host: string) {
    for (const prog of portOpeningProgramFns(ns)) {
        if (ns.fileExists(prog.file, 'home')) {
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

            if (
                this.ns.getServerMaxMoney(host) > 0
                && !this._targets.has(host)
            ) {
                this._targets.add(host);
                newTargets.push(host);
            }
        }

        if (newWorkers.length > 0) {
            notifySubscriptions(this.ns, newWorkers, this.workerSubscriptions);
            this.workerSubscriptions = this.workerSubscriptions.filter(
                (sub) =>
                    sub.failedNotifications < CONFIG.subscriptionMaxRetries,
            );
        }

        if (newTargets.length > 0) {
            notifySubscriptions(this.ns, newTargets, this.targetSubscriptions);
            this.targetSubscriptions = this.targetSubscriptions.filter(
                (sub) =>
                    sub.failedNotifications < CONFIG.subscriptionMaxRetries,
            );
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

function registerSubscriber(
    ns: NS,
    subscription: ClientSubscription,
    subscriptions: Subscription[],
) {
    const existingSubscription = subscriptions.find(
        (sub) => sub.port === subscription.port,
    );
    if (existingSubscription) {
        // Assume that subscriptions with the same port are for
        // the same service.
        ns.print(
            `WARN: replacing subscription for port ${subscription.port}. `
                + `Old: ${existingSubscription.messageType} `
                + `New: ${subscription.messageType}`,
        );
        existingSubscription.messageType = subscription.messageType;
        existingSubscription.failedNotifications = 0;
    } else {
        subscriptions.push({
            failedNotifications: 0,
            missedUpdates: [],
            ...subscription,
        } as Subscription);
    }
}

function notifySubscriptions(
    ns: NS,
    hosts: string[],
    subscriptions: Subscription[],
) {
    for (const sub of subscriptions) {
        const hostsToSend = [...sub.missedUpdates, ...hosts];
        // TODO [ZEFS 2025-09-05 #292]: This is janky as hell and
        // completely unchecked on the client-side, but it will
        // probably work on the server side? Is there a better way to
        // handle this? We can't send the whole protocol through the
        // port because it has validator functions.
        const envelope = {
            type: sub.messageType,
            id: null,
            payload: hostsToSend,
        };
        if (ns.tryWritePort(sub.port, envelope)) {
            // Reset failed notifications when we succeed in sending them
            sub.failedNotifications = 0;
            sub.missedUpdates = [];
        } else {
            ns.print(
                `WARN: failed to send message ${sub.messageType} to port ${sub.port}`,
            );
            // We retry a failing subscription a configurable number
            // of times
            sub.failedNotifications += 1;
            extend(sub.missedUpdates, hosts);
        }
    }
}
