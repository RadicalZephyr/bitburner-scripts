import type { NS } from '@ns';

import { defineProtocol, BaseClient } from 'util/protocol';
import { isLiteral, Validator } from 'util/validate';

/** Supported message types for harvest control. */
export const MessageType = {
    Shutdown: 'Shutdown',
} as const;

/** Payload for harvest control messages. */
const Payload = 'B_HarvestShutdown';
export type Payload = typeof Payload;

const isPayload: Validator<Payload> = isLiteral(Payload);

export const HarvestProtocol = defineProtocol({
    [MessageType.Shutdown]: {
        payload: isPayload,
    },
});

export type HarvestProtocolDef = (typeof HarvestProtocol)['def'];

/**
 * Client helper for communicating with harvest scripts.
 */
export class HarvestClient {
    #client: BaseClient<HarvestProtocolDef>;

    constructor(ns: NS, portId: number) {
        const port = ns.getPortHandle(portId);
        this.#client = new BaseClient(HarvestProtocol, port, port);
    }

    /**
     * Request that the harvest script shut down gracefully.
     */
    shutdown() {
        return this.#client.sendMessage(MessageType.Shutdown, Payload);
    }

    /**
     * Try to request shutdown without waiting for port space.
     *
     * @returns True if the message was written successfully.
     */
    tryShutdown(): boolean {
        return this.#client.trySendMessage(MessageType.Shutdown, Payload);
    }
}
