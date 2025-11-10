import { defineProtocol, BaseClient } from 'util/protocol';
import { isLiteral } from 'util/validate';
/** Supported message types for harvest control. */
export const MessageType = {
    Shutdown: 'Shutdown',
};
/** Payload for harvest control messages. */
const Payload = 'B_HarvestShutdown';
const isPayload = isLiteral(Payload);
export const HarvestProtocol = defineProtocol({
    [MessageType.Shutdown]: {
        payload: isPayload,
    },
});
/**
 * Client helper for communicating with harvest scripts.
 */
export class HarvestClient {
    #client;
    constructor(ns, portId) {
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
    tryShutdown() {
        return this.#client.trySendMessage(MessageType.Shutdown, Payload);
    }
}
