import type { NS } from 'netscript';

import { defineProtocol, BaseClient } from 'util/protocol';
import { isLiteral, isNumber, isOptional, Validator } from 'util/validate';

export const PORT_ALLOCATOR_PORT = 15;
export const PORT_ALLOCATOR_RESPONSE_PORT = 16;

export const MessageType = {
    PortRequest: 'PortRequest',
    PortRelease: 'PortRelease',
} as const;

const PortRequest = 'SP_PortRequest';

const isPortRequest: Validator<typeof PortRequest> = isLiteral(PortRequest);

export const PortAllocatorProtocol = defineProtocol({
    [MessageType.PortRequest]: {
        payload: isPortRequest,
        response: isOptional(isNumber),
    },
    [MessageType.PortRelease]: {
        payload: isNumber,
    },
});

export type PortAllocatorProtocolDef = (typeof PortAllocatorProtocol)['def'];

/**
 * Client for interacting with the PortAllocator service.
 */
export class PortClient {
    #client: BaseClient<PortAllocatorProtocolDef>;

    constructor(ns: NS) {
        this.#client = new BaseClient(
            PortAllocatorProtocol,
            ns.getPortHandle(PORT_ALLOCATOR_PORT),
            ns.getPortHandle(PORT_ALLOCATOR_RESPONSE_PORT),
        );
    }

    /** Request a port from the allocator. */
    requestPort(): Promise<number | null | undefined> {
        return this.#client.sendMessageReceiveResponse(
            MessageType.PortRequest,
            PortRequest,
        );
    }

    /** Release a previously allocated port. */
    releasePort(port: number): Promise<void> {
        return this.#client.sendMessage(MessageType.PortRelease, port);
    }
}
