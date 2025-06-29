import type { NS, NetscriptPort } from "netscript";

export const MANAGER_PORT: number = 101;

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

export type Payload = string | Heartbeat;

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
        return this.port.tryWrite([MessageType.Heartbeat, hb]);
    }

    private async sendMessage(type: MessageType, payload: Payload) {
        let message: Message = [type, payload];
        while (!this.port.tryWrite(message)) {
            await this.ns.sleep(200);
        }
    }
}
