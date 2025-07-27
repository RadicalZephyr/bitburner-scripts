import type { NS, NetscriptPort } from 'netscript';
import { makeFuid } from './fuid';

export type Message<Type, Payload> = [
    type: Type,
    requestId: string,
    payload: Payload,
];

export type Response<Payload> = [requestId: string, payload: Payload];

export class Client<Type, Payload, ResponsePayload> {
    ns: NS;
    sendPort: NetscriptPort;
    receivePort: NetscriptPort;

    constructor(ns: NS, sendPort: number, receivePort: number) {
        this.ns = ns;
        this.sendPort = ns.getPortHandle(sendPort);
        this.receivePort = ns.getPortHandle(receivePort);
    }

    trySendMessage(type: Type, payload: Payload): boolean {
        return trySendMessage(this.sendPort, type, payload);
    }

    async sendMessage(
        type: Type,
        payload: Payload,
        pollPeriod?: number,
    ): Promise<void> {
        return await sendMessage(
            this.ns,
            this.sendPort,
            type,
            payload,
            pollPeriod,
        );
    }

    async sendMessageReceiveResponse(
        type: Type,
        payload: Payload,
        pollPeriod?: number,
    ): Promise<ResponsePayload> {
        return await sendMessageReceiveResponse(
            this.ns,
            this.sendPort,
            this.receivePort,
            type,
            payload,
            pollPeriod,
        );
    }
}

export function trySendMessage<Type, Payload>(
    sendPort: NetscriptPort,
    type: Type,
    payload: Payload,
): boolean {
    const message = [type, null, payload] as Message<Type, Payload>;
    return sendPort.tryWrite(message);
}

export async function sendMessage<Type, Payload>(
    ns: NS,
    sendPort: NetscriptPort,
    type: Type,
    payload: Payload,
    pollPeriod?: number,
): Promise<void> {
    const _pollPeriod = pollPeriod ?? 100;
    const message = [type, null, payload] as Message<Type, Payload>;

    while (!sendPort.tryWrite(message)) {
        await ns.sleep(_pollPeriod);
    }
}

export async function sendMessageReceiveResponse<
    Type,
    Payload,
    ResponsePayload,
>(
    ns: NS,
    sendPort: NetscriptPort,
    receivePort: NetscriptPort,
    type: Type,
    payload: Payload,
    pollPeriod?: number,
): Promise<ResponsePayload> {
    const _pollPeriod = pollPeriod ?? 100;
    const requestId = makeReqId(ns);
    const message = [type, requestId, payload] as Message<Type, Payload>;

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
            const nextMessage = receivePort.peek() as Response<ResponsePayload>;
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
