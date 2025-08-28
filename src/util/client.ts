import type { NS, NetscriptPort } from 'netscript';

import { makeFuid } from 'util/fuid';

/** Shape of a message definition used to construct typed port messages. */
export type MessageSpec = {
    type: unknown;
    payload: unknown;
    response: unknown;
};

export type Message<M extends MessageSpec> = [
    type: M['type'],
    requestId: string | null,
    payload: M['payload'],
];

export type Response<M extends MessageSpec> = [
    requestId: string,
    payload: M['response'],
];

export type PayloadFor<M extends MessageSpec, T> = Extract<
    M,
    { type: T }
>['payload'];

export type ResponseFor<M extends MessageSpec, T> = Extract<
    M,
    { type: T }
>['response'];

/**
 * Client for sending messages over Netscript ports.
 */
export class Client<M extends MessageSpec> {
    ns: NS;
    sendPort: NetscriptPort;
    receivePort: NetscriptPort;

    constructor(ns: NS, sendPort: number, receivePort: number) {
        this.ns = ns;
        this.sendPort = ns.getPortHandle(sendPort);
        this.receivePort = ns.getPortHandle(receivePort);
    }

    trySendMessage<T extends M['type']>(
        type: T,
        payload: PayloadFor<M, T>,
    ): boolean {
        return trySendMessage<M, T>(this.sendPort, type, payload);
    }

    async sendMessage<T extends M['type']>(
        type: T,
        payload: PayloadFor<M, T>,
        pollPeriod?: number,
    ): Promise<void> {
        return await sendMessage<M, T>(
            this.ns,
            this.sendPort,
            type,
            payload,
            pollPeriod,
        );
    }

    async sendMessageReceiveResponse<T extends M['type']>(
        type: T,
        payload: PayloadFor<M, T>,
        pollPeriod?: number,
    ): Promise<ResponseFor<M, T>> {
        return await sendMessageReceiveResponse<M, T>(
            this.ns,
            this.sendPort,
            this.receivePort,
            type,
            payload,
            pollPeriod,
        );
    }
}

/**
 * Attempt to send a message without waiting for a response.
 *
 * @param sendPort - Port used to send the message
 * @param type - Message type
 * @param payload - Message payload
 * @returns Whether the message was written to the port
 */
export function trySendMessage<M extends MessageSpec, T extends M['type']>(
    sendPort: NetscriptPort,
    type: T,
    payload: PayloadFor<M, T>,
): boolean {
    const message = [type, null, payload] as Message<Extract<M, { type: T }>>;
    return sendPort.tryWrite(message);
}

/**
 * Send a message without expecting a response.
 *
 * @param ns - Netscript API
 * @param sendPort - Port used to send the message
 * @param type - Message type
 * @param payload - Message payload
 * @param pollPeriod - How often to retry if the port is full
 */
export async function sendMessage<M extends MessageSpec, T extends M['type']>(
    ns: NS,
    sendPort: NetscriptPort,
    type: T,
    payload: PayloadFor<M, T>,
    pollPeriod?: number,
): Promise<void> {
    const _pollPeriod = pollPeriod ?? 100;
    const message = [type, null, payload] as Message<Extract<M, { type: T }>>;

    while (!sendPort.tryWrite(message)) {
        await ns.sleep(_pollPeriod);
    }
}

/**
 * Send a message and wait for a response.
 *
 * @param ns - Netscript API
 * @param sendPort - Port used to send the message
 * @param receivePort - Port used to receive the response
 * @param type - Message type
 * @param payload - Message payload
 * @param pollPeriod - How often to poll when waiting for a response
 * @returns The response payload
 */
export async function sendMessageReceiveResponse<
    M extends MessageSpec,
    T extends M['type'],
>(
    ns: NS,
    sendPort: NetscriptPort,
    receivePort: NetscriptPort,
    type: T,
    payload: PayloadFor<M, T>,
    pollPeriod?: number,
): Promise<ResponseFor<M, T>> {
    const _pollPeriod = pollPeriod ?? 100;
    const requestId = makeReqId(ns);
    const message = [type, requestId, payload] as Message<
        Extract<M, { type: T }>
    >;

    while (!sendPort.tryWrite(message)) {
        await ns.sleep(_pollPeriod);
    }

    while (true) {
        // Check if port is empty, if so we can wait until nextWrite
        if (receivePort.empty()) await receivePort.nextWrite();

        // Otherwise it has messages, so spin until it's empty
        // checking for our requestId. If our requestId isn't the
        // first message, then it's probably coming later and other
        // client's messages are before it in the port.
        while (!receivePort.empty()) {
            const nextMessage = receivePort.peek() as Response<
                Extract<M, { type: T }>
            >;
            if (nextMessage[0] === requestId) {
                // N.B. Important to pop our message from the port so
                // other messages can be processed!
                receivePort.read();
                return nextMessage[1];
            }
            await ns.sleep(_pollPeriod);
        }
    }
}

function makeReqId(ns: NS) {
    return makeFuid(ns);
}
