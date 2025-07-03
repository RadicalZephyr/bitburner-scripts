import type { NS, NetscriptPort } from "netscript";

export const DISCOVERY_PORT = 150;
export const DISCOVERY_RESPONSE_PORT = 151;

export enum MessageType {
    RequestWorkers,
    RequestTargets,
}

export interface RequestWorkers { }
export interface RequestTargets { }

export type Payload = RequestWorkers | RequestTargets | null;

export type Message = [type: MessageType, requestId: string, payload: Payload];
export type Response = [requestId: string, response: any];

/** Hide communication with the discovery service behind a simple API. */
export class DiscoveryClient {
    ns: NS;
    port: NetscriptPort;
    responsePort: NetscriptPort;

    constructor(ns: NS) {
        this.ns = ns;
        this.port = ns.getPortHandle(DISCOVERY_PORT);
        this.responsePort = ns.getPortHandle(DISCOVERY_RESPONSE_PORT);
    }

    /** Request the list of known worker hosts. */
    async requestWorkers(): Promise<string[]> {
        return await this.sendMessage(MessageType.RequestWorkers, {});
    }

    /** Request the list of known target hosts. */
    async requestTargets(): Promise<string[]> {
        return await this.sendMessage(MessageType.RequestTargets, {});
    }

    private async sendMessage(type: MessageType, payload: Payload) {
        return await sendMessage(this.ns, this.port, this.responsePort, type, payload);
    }
}

function makeReqId(ns: NS) {
    const pid = ns.pid;
    const ts = Date.now();
    const r = Math.floor(Math.random() * 1e6);
    return `${pid}-${ts}-${r}`;
}

async function sendMessage(
    ns: NS,
    port: NetscriptPort,
    responsePort: NetscriptPort,
    type: MessageType,
    payload: Payload,
) {
    const requestId = makeReqId(ns);
    const message: Message = [type, requestId, payload];
    while (!port.tryWrite(message)) {
        await ns.sleep(200);
    }
    while (true) {
        await responsePort.nextWrite();
        const next = responsePort.peek() as Response;
        if (next[0] === requestId) {
            responsePort.read();
            return next[1];
        }
    }
}
