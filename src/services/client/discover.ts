import type { NS } from '@ns';

import { makeFuid } from 'util/fuid';
import { ApiStream } from 'util/sodium-api';
import { isNumber, isObjectLike, isString, Validator } from 'util/validate';

import { Set } from 'lib/immutable';
import { Cell, Stream, Transaction } from 'lib/sodium';

import { CONFIG } from 'services/config';

type Hostname = string;

class HostSource {
    readonly #newHostsSource: ApiStream<Hostname> = new ApiStream();

    readonly newHosts: Stream<Hostname> = this.#newHostsSource.stream;

    readonly hosts: Cell<Immutable.Set<Hostname>> = this.newHosts.accum<
        Immutable.Set<Hostname>
    >(Set<Hostname>(), (newHost, hosts) => {
        return hosts.add(newHost);
    });

    registerNewHostsSource(source: Stream<Hostname>): () => void {
        const unlistenStream = this.#newHostsSource.setSource(source);
        // NOTE: It's very important that we listen to the cell,
        // otherwise it will be cleaned up I guess and never receive
        // updates!
        const unlistenCell = this.hosts.listen(() => null);
        return () => {
            unlistenStream();
            unlistenCell();
        };
    }
}

export const WorkerSource = new HostSource();

export const TargetSource = new HostSource();

export interface Subscription {
    messageType: string;
    port: number;
}

const isSubscription: Validator<Subscription> = isObjectLike({
    messageType: isString,
    port: isNumber,
});

interface ServerSubscription extends Subscription {
    failedNotifications: number;
    missedUpdates: string[];
}

/** Hide communication with the discovery service behind a simple API. */
export class DiscoveryClient {
    #ns: NS;
    #workerSubscriptions: ServerSubscription[] = [];
    #targetSubscriptions: ServerSubscription[] = [];

    constructor(ns: NS) {
        this.#ns = ns;
        const unlistenWorkers = WorkerSource.newHosts.listen(
            (worker: Hostname) => {
                this.notifyWorkerSubscriptions(worker);
            },
        );
        const unlistenTargets = TargetSource.newHosts.listen(
            (target: Hostname) => {
                this.notifyTargetSubscriptions(target);
            },
        );
        ns.atExit(() => {
            unlistenWorkers();
            unlistenTargets();
        }, makeFuid(ns));
        void this.pollFlushSubscriptions();
    }

    private async pollFlushSubscriptions() {
        let running = true;
        this.#ns.atExit(() => {
            running = false;
        }, makeFuid(this.#ns));
        while (running) {
            this.notifyWorkerSubscriptions();
            this.notifyTargetSubscriptions();
            await this.#ns.asleep(100);
        }
    }

    private notifyTargetSubscriptions(target?: string) {
        notifySubscriptions(this.#ns, this.#targetSubscriptions, target);
        this.#targetSubscriptions = this.#targetSubscriptions.filter(
            (sub) => sub.failedNotifications < CONFIG.subscriptionMaxRetries,
        );
    }

    private notifyWorkerSubscriptions(worker?: string) {
        notifySubscriptions(this.#ns, this.#workerSubscriptions, worker);
        this.#workerSubscriptions = this.#workerSubscriptions.filter(
            (sub) => sub.failedNotifications < CONFIG.subscriptionMaxRetries,
        );
    }

    /** Request the list of known worker hosts. */
    requestWorkers(sub?: Subscription): Promise<Hostname[]> {
        return Transaction.execute(() => {
            if (isSubscription(sub)) {
                registerSubscriber(this.#ns, sub, this.#workerSubscriptions);
            }
            return Promise.resolve(WorkerSource.hosts.sample().toArray());
        });
    }

    /** Request the list of known target hosts. */
    requestTargets(sub?: Subscription): Promise<Hostname[]> {
        return Transaction.execute(() => {
            if (isSubscription(sub)) {
                registerSubscriber(this.#ns, sub, this.#targetSubscriptions);
            }
            return Promise.resolve(TargetSource.hosts.sample().toArray());
        });
    }
}

function registerSubscriber(
    ns: NS,
    subscription: Subscription,
    subscriptions: ServerSubscription[],
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
        } as ServerSubscription);
    }
}

function notifySubscriptions(
    ns: NS,
    subscriptions: ServerSubscription[],
    host?: string,
) {
    for (const sub of subscriptions) {
        const hostsToSend =
            host != null ? [...sub.missedUpdates, host] : sub.missedUpdates;
        if (hostsToSend.length === 0) continue;

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
            if (host != null) sub.missedUpdates.push(host);
        }
    }
}
