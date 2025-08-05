import type { NS } from 'netscript';

import { Client, Message as ClientMessage } from 'util/client';

export const SERVER_PURCHASE_PORT = 21;
export const SERVER_PURCHASE_RESPONSE_PORT = 22;

export enum MessageType {
    BuyOrder,
    SetUrgency,
}

export interface BuyOrderCommand {
    state: boolean;
}

export interface SetUrgencyCommand {
    urgency: number;
}

export type Payload = BuyOrderCommand | SetUrgencyCommand;

export type Message = ClientMessage<MessageType, Payload>;

/** Client for interacting with the server purchase service. */
export class ServerPurchaseClient extends Client<MessageType, Payload, null> {
    constructor(ns: NS) {
        super(ns, SERVER_PURCHASE_PORT, SERVER_PURCHASE_RESPONSE_PORT);
    }

    /** Signal the daemon to start or stop purchasing servers. */
    buy(state = true): boolean {
        return this.trySendMessage(MessageType.BuyOrder, { state });
    }

    /** Set the urgency level used to scale polling frequency. */
    setUrgency(urgency: number): boolean {
        return this.trySendMessage(MessageType.SetUrgency, { urgency });
    }
}
