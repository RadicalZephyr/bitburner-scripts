import type { NS, NetscriptPort } from "netscript";

export type Message<Type, Payload> = [
    type: Type,
    requestId: string,
    payload: Payload
];

export type Response<Payload> = [
    requestId: string,
    payload: Payload,
];

export class Client<Type, Payload, ResponsePayload> {
    ns: NS;
    sendPort: NetscriptPort;
    receivePort: NetscriptPort;

    constructor(ns: NS, sendPort: number, receivePort: number) {
        this.ns = ns;
        this.sendPort = ns.getPortHandle(sendPort);
        this.receivePort = ns.getPortHandle(receivePort);
    }

    async sendMessage(type: Type, payload: Payload): Promise<ResponsePayload> {
        return await sendMessage(this.ns, this.sendPort, this.receivePort, type, payload);
    }
}

export async function sendMessage<Type, Payload, ResponsePayload>(
    ns: NS,
    port: NetscriptPort,
    responsePort: NetscriptPort,
    type: Type,
    payload: Payload
): Promise<ResponsePayload> {
    const requestId = makeReqId(ns);


    let message = [type, requestId, payload] as Message<Type, Payload>;
    while (!port.tryWrite(message)) {
        await ns.sleep(200);
    }

    while (true) {
        await responsePort.nextWrite();
        let nextMessage = responsePort.peek() as Response<ResponsePayload>;
        if (nextMessage[0] === requestId) {
            // N.B. Important to pop our message from the port so
            // other messages can be processed!
            responsePort.read();
            return nextMessage[1];
        }
    }
}

function makeReqId(ns: NS) {
    const pid = ns.pid;
    const ts = Date.now();
    const r = Math.floor(Math.random() * 1e6);
    return `${pid}-${ts}-${r}`;
}
