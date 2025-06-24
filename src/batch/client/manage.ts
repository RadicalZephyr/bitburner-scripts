import type { NS, NetscriptPort } from "netscript";

export const MANAGER_PORT: number = 200;

export enum MessageType {
    NewTarget,
}

export type Payload = string;

export type Message = [
    type: MessageType,
    payload: Payload,
];

function newTargetMessage(hostname: string): Message {
    return [
        MessageType.NewTarget,
        hostname
    ];
}

export class ManagerClient {
    ns: NS;
    port: NetscriptPort;

    constructor(ns: NS) {
        this.ns = ns;
        this.port = ns.getPortHandle(MANAGER_PORT);
    }

    async sendNewTarget(hostname: string) {
        let newTargetMsg = newTargetMessage(hostname);
        while (!this.port.tryWrite(newTargetMessage)) {
            await ns.sleep(200);
        }
    }
}
