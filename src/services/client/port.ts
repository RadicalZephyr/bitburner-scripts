import type { NS } from "netscript";

import { Client, Message as ClientMessage } from "util/client";

export const PORT_ALLOCATOR_PORT = 15;
export const PORT_ALLOCATOR_RESPONSE_PORT = 16;

export enum MessageType {
    PortRequest,
    PortRelease,
}

export interface PortRelease {
    port: number;
}

export type Payload = PortRelease | null;
export type Message = ClientMessage<MessageType, Payload>;

export class PortClient extends Client<MessageType, Payload, number | null> {
    constructor(ns: NS) {
        super(ns, PORT_ALLOCATOR_PORT, PORT_ALLOCATOR_RESPONSE_PORT);
    }

    /** Request a port from the allocator. */
    async requestPort(): Promise<number | null> {
        return await this.sendMessageReceiveResponse(MessageType.PortRequest, null);
    }

    /** Release a previously allocated port. */
    async releasePort(port: number): Promise<void> {
        await this.sendMessage(MessageType.PortRelease, { port });
    }
}
