import { defineProtocol, BaseClient } from 'util/protocol';
import { isLiteral, isNumber, isOptional } from 'util/validate';
export const PORT_ALLOCATOR_PORT = 15;
export const PORT_ALLOCATOR_RESPONSE_PORT = 16;
export const MessageType = {
    PortRequest: 'PortRequest',
    PortRelease: 'PortRelease',
};
const PortRequest = 'SP_PortRequest';
const isPortRequest = isLiteral(PortRequest);
export const PortAllocatorProtocol = defineProtocol({
    [MessageType.PortRequest]: {
        payload: isPortRequest,
        response: isOptional(isNumber),
    },
    [MessageType.PortRelease]: {
        payload: isNumber,
    },
});
/**
 * Client for interacting with the PortAllocator service.
 */
export class PortClient {
    #client;
    constructor(ns) {
        this.#client = new BaseClient(PortAllocatorProtocol, ns.getPortHandle(PORT_ALLOCATOR_PORT), ns.getPortHandle(PORT_ALLOCATOR_RESPONSE_PORT));
    }
    /** Request a port from the allocator. */
    requestPort() {
        return this.#client.sendMessageReceiveResponse(MessageType.PortRequest, PortRequest);
    }
    /** Release a previously allocated port. */
    releasePort(port) {
        return this.#client.sendMessage(MessageType.PortRelease, port);
    }
}
