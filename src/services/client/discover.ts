import type { NS } from 'netscript';

import { Client, Message as ClientMessage } from 'util/client';

export const DISCOVERY_PORT = 1;
export const DISCOVERY_RESPONSE_PORT = 2;

export enum MessageType {
    RequestWorkers,
    RequestTargets,
}

export interface Subscription {
    messageType: number;
    port: number;
}

export interface RequestWorkers {
    pushUpdates?: Subscription;
}

export interface RequestTargets {
    pushUpdates?: Subscription;
}

export type Messages =
    | {
          type: MessageType.RequestWorkers;
          payload: RequestWorkers;
          response: string[];
      }
    | {
          type: MessageType.RequestTargets;
          payload: RequestTargets;
          response: string[];
      };

export type Message = ClientMessage<Messages>;

/** Hide communication with the discovery service behind a simple API. */
export class DiscoveryClient extends Client<Messages> {
    constructor(ns: NS) {
        super(ns, DISCOVERY_PORT, DISCOVERY_RESPONSE_PORT);
    }

    /** Request the list of known worker hosts. */
    async requestWorkers(pushUpdates?: Subscription): Promise<string[]> {
        return await this.sendMessageReceiveResponse(
            MessageType.RequestWorkers,
            {
                pushUpdates,
            },
        );
    }

    /** Request the list of known target hosts. */
    async requestTargets(pushUpdates?: Subscription): Promise<string[]> {
        return await this.sendMessageReceiveResponse(
            MessageType.RequestTargets,
            {
                pushUpdates,
            },
        );
    }
}
