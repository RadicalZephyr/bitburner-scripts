import type { NS, NetscriptPort } from "netscript";

export const TRACKER_PORT = 30;
export const TRACKER_RESPONSE_PORT = 31;

export enum MessageType {
    RequestTicks,
    RequestIndicators,
}

export type Message = [type: MessageType, requestId: string, payload: any];
export type Response = [requestId: string, response: any];

export class TrackerClient {
    ns: NS;
    port: NetscriptPort;
    responsePort: NetscriptPort;

    constructor(ns: NS) {
        this.ns = ns;
        this.port = ns.getPortHandle(TRACKER_PORT);
        this.responsePort = ns.getPortHandle(TRACKER_RESPONSE_PORT);
    }

    /** Request raw tick data for all tracked symbols. */
    async requestTicks() {
        return await this.sendMessage(MessageType.RequestTicks, null);
    }

    /** Request computed indicators for all tracked symbols. */
    async requestIndicators() {
        return await this.sendMessage(MessageType.RequestIndicators, null);
    }

    private async sendMessage(type: MessageType, payload: any) {
        const requestId = makeReqId(this.ns);
        const message: Message = [type, requestId, payload];
        while (!this.port.tryWrite(message)) {
            await this.ns.sleep(200);
        }
        while (true) {
            await this.responsePort.nextWrite();
            const next = this.responsePort.peek() as Response;
            if (next[0] === requestId) {
                this.responsePort.read();
                return next[1];
            }
        }
    }
}

function makeReqId(ns: NS) {
    const pid = ns.pid;
    const ts = Date.now();
    const r = Math.floor(Math.random() * 1e6);
    return `${pid}-${ts}-${r}`;
}
