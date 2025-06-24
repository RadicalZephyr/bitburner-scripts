import type { NS, NetscriptPort } from "netscript";

export const MANAGER_PORT: number = 101;

export enum MessageType {
    NewTarget,
    FinishedTilling,
    FinishedSowing,
}

export type Payload = string;

export type Message = [
    type: MessageType,
    payload: Payload,
];

export class ManagerClient {
    ns: NS;
    port: NetscriptPort;

    constructor(ns: NS) {
        this.ns = ns;
        this.port = ns.getPortHandle(MANAGER_PORT);
    }

    async newTarget(hostname: string) {
        await this.sendMessage(MessageType.NewTarget, hostname);
    }

    async finishedTilling(hostname: string) {
        await this.sendMessage(MessageType.FinishedTilling, hostname);
    }

    async finishedSowing(hostname: string) {
        await this.sendMessage(MessageType.FinishedSowing, hostname);
    }

    private async sendMessage(type: MessageType, hostname: string) {
        let message = [type, hostname];
        while (!this.port.tryWrite(message)) {
            await this.ns.sleep(200);
        }
    }
}
