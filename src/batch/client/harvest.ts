import type { NS } from 'netscript';

import { Client, Message as ClientMessage } from 'util/client';

/** Supported message types for harvest control. */
export enum MessageType {
    Shutdown,
}

/** Payload for harvest control messages. */
export type Payload = null;

/** Harvest control message format. */
export type Message = ClientMessage<MessageType, Payload>;

/**
 * Client helper for communicating with harvest scripts.
 */
export class HarvestClient extends Client<MessageType, Payload, void> {
    constructor(ns: NS, portId: number) {
        super(ns, portId, portId);
    }

    /**
     * Request that the harvest script shut down gracefully.
     */
    async shutdown() {
        await this.sendMessage(MessageType.Shutdown, null);
    }

    /**
     * Try to request shutdown without waiting for port space.
     *
     * @returns True if the message was written successfully.
     */
    tryShutdown(): boolean {
        return this.trySendMessage(MessageType.Shutdown, null);
    }
}
