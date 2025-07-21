import type { NS } from "netscript";

import { Client, Message as ClientMessage } from "util/client";
import { Lifecycle as MonitorLifecycle } from "batch/client/monitor";

export const TASK_SELECTOR_PORT: number = 11;
export const TASK_SELECTOR_RESPONSE_PORT: number = 12;

export enum MessageType {
    NewTarget,
    FinishedTilling,
    FinishedSowing,
    Heartbeat,
    RequestLifecycle,
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

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface LifecycleRequest { }

export type LifecycleSnapshot = [string, MonitorLifecycle][];

export type Payload = string | string[] | Heartbeat | LifecycleRequest;

export type Message = ClientMessage<MessageType, Payload>;

export class TaskSelectorClient extends Client<MessageType, Payload, LifecycleSnapshot> {
    constructor(ns: NS) {
        super(ns, TASK_SELECTOR_PORT, TASK_SELECTOR_RESPONSE_PORT)
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

    /**
     * Request a snapshot of lifecycle state for all tracked hosts.
     *
     * @returns Array of `[hostname, Lifecycle]` pairs describing current state.
     */
    async requestLifecycle(): Promise<LifecycleSnapshot> {
        const payload: LifecycleRequest = {};
        return await this.sendMessageReceiveResponse(
            MessageType.RequestLifecycle,
            payload,
        );
    }
}
