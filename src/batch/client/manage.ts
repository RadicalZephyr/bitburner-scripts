import type { NS, NetscriptPort } from "netscript";

import { Client, Message as ClientMessage } from "util/client";

export const MANAGER_PORT: number = 11;
export const MANAGER_RESPONSE_PORT: number = 12;

export enum MessageType {
    NewTarget,
    FinishedTilling,
    FinishedSowing,
    Heartbeat,
}

export enum Lifecycle {
    Till,
    Sow,
    Harvest,
}

export interface Heartbeat {
    pid: number;
    filename: string;
    target: string;
    lifecycle: Lifecycle;
}

export type Payload = string | string[] | Heartbeat;

export type Message = ClientMessage<MessageType, Payload>;

export class ManagerClient extends Client<MessageType, Payload, void> {
    constructor(ns: NS) {
        super(ns, MANAGER_PORT, MANAGER_RESPONSE_PORT)
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

    /**
     * Send a heartbeat message to the manager.
     *
     * This allows the manager to recover running targets when it is restarted.
     */
    async heartbeat(pid: number, filename: string, target: string, lifecycle: Lifecycle) {
        const hb: Heartbeat = { pid, filename, target, lifecycle };
        await this.sendMessage(MessageType.Heartbeat, hb);
    }

    /**
     * Try to send a heartbeat message to the manager without waiting
     * for space in the port.
     *
     * This allows the manager to recover running targets when it is restarted.
     */
    tryHeartbeat(pid: number, filename: string, target: string, lifecycle: Lifecycle): boolean {
        const hb: Heartbeat = { pid, filename, target, lifecycle };
        return this.trySendMessage(MessageType.Heartbeat, hb);
    }
}
