import type { NS } from '@ns';

import { defineProtocol, BaseClient, AnyRequest } from 'util/protocol';
import { ApiStream } from 'util/sodium-api';
import {
    isArrayOf,
    isNumber,
    isObjectLike,
    isOptional,
    isString,
    Validator,
} from 'util/validate';

import { Set } from 'lib/immutable';
import { Cell, Stream } from 'lib/sodium';

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
        return this.#newHostsSource.setSource(source);
    }
}

export const WorkerSource = new HostSource();

export const TargetSource = new HostSource();

export const DISCOVERY_PORT = 1;
export const DISCOVERY_RESPONSE_PORT = 2;

export const MessageType = {
    RequestWorkers: 'RequestWorkers',
    RequestTargets: 'RequestTargets',
} as const;

export interface Subscription {
    messageType: string;
    port: number;
}

const isSubscription: Validator<Subscription> = isObjectLike({
    messageType: isString,
    port: isNumber,
});

export interface HostRequest {
    pushUpdates?: Subscription;
}

const isHostRequest: Validator<HostRequest> = isObjectLike({
    pushUpdates: isOptional(isSubscription),
});

export const DiscoverProtocol = defineProtocol({
    [MessageType.RequestWorkers]: {
        payload: isHostRequest,
        response: isArrayOf(isString),
    },
    [MessageType.RequestTargets]: {
        payload: isHostRequest,
        response: isArrayOf(isString),
    },
});

export type DiscoverProtocolDef = (typeof DiscoverProtocol)['def'];

export type Message = AnyRequest<DiscoverProtocolDef>;

/** Hide communication with the discovery service behind a simple API. */
export class DiscoveryClient {
    #client: BaseClient<DiscoverProtocolDef>;

    constructor(ns: NS) {
        this.#client = new BaseClient(
            DiscoverProtocol,
            ns.getPortHandle(DISCOVERY_PORT),
            ns.getPortHandle(DISCOVERY_RESPONSE_PORT),
        );
    }

    /** Request the list of known worker hosts. */
    requestWorkers(pushUpdates?: Subscription): Promise<string[]> {
        return this.#client.sendMessageReceiveResponse(
            MessageType.RequestWorkers,
            {
                pushUpdates,
            },
        );
    }

    /** Request the list of known target hosts. */
    requestTargets(pushUpdates?: Subscription): Promise<string[]> {
        return this.#client.sendMessageReceiveResponse(
            MessageType.RequestTargets,
            {
                pushUpdates,
            },
        );
    }
}
