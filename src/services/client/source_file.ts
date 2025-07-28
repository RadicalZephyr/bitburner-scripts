import type { NS } from 'netscript';
import { Client, Message as ClientMessage } from 'util/client';

export const SOURCE_FILE_PORT = 19;
export const SOURCE_FILE_RESPONSE_PORT = 20;

export enum MessageType {
    RequestLevel,
    RequestAll,
}

export interface RequestLevel {
    n: number;
}

export type Payload = RequestLevel | null;
export type Message = ClientMessage<MessageType, Payload>;

export type ResponsePayload = number | Record<number, number>;

/** Client for the SourceFile service. */
export class SourceFileClient extends Client<
    MessageType,
    Payload,
    ResponsePayload
> {
    constructor(ns: NS) {
        super(ns, SOURCE_FILE_PORT, SOURCE_FILE_RESPONSE_PORT);
    }

    /**
     * Query the level of a specific Source File.
     *
     * @param sf - Source File number
     * @returns Level of the Source File or 0 if not owned
     */
    async getLevel(sf: number): Promise<number> {
        const payload: RequestLevel = { n: sf };
        const lvl = (await this.sendMessageReceiveResponse(
            MessageType.RequestLevel,
            payload,
        )) as number;
        return typeof lvl === 'number' ? lvl : 0;
    }

    /**
     * Retrieve all owned Source Files.
     *
     * @returns Mapping of Source File number to level
     */
    async getAll(): Promise<Record<number, number>> {
        const res = (await this.sendMessageReceiveResponse(
            MessageType.RequestAll,
            null,
        )) as Record<number, number>;
        return res && typeof res === 'object' ? res : {};
    }
}
