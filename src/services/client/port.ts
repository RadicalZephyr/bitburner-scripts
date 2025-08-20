import type { NS } from 'netscript';

import { Client, Message as ClientMessage } from 'util/client';

export const PORT_ALLOCATOR_PORT = 15;
export const PORT_ALLOCATOR_RESPONSE_PORT = 16;

export enum MessageType {
    PortRequest,
    PortRelease,
}

export interface PortRelease {
    port: number;
}

export type Messages =
    | {
          type: MessageType.PortRequest;
          payload: null;
          response: number | null;
      }
    | {
          type: MessageType.PortRelease;
          payload: PortRelease;
          response: void;
      };

export type Message = ClientMessage<Messages>;

export class PortClient extends Client<Messages> {
    constructor(ns: NS) {
        super(ns, PORT_ALLOCATOR_PORT, PORT_ALLOCATOR_RESPONSE_PORT);
    }

    /** Request a port from the allocator. */
    async requestPort(): Promise<number | null> {
        return await this.sendMessageReceiveResponse(
            MessageType.PortRequest,
            null,
        );
    }

    /** Release a previously allocated port. */
    async releasePort(port: number): Promise<void> {
        await this.sendMessage(MessageType.PortRelease, { port });
    }
}
