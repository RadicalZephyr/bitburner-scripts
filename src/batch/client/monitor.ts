import type { NS, NetscriptPort } from "netscript";

import { Client, Message as ClientMessage } from "util/client";

export const MONITOR_PORT = 13;
export const MONITOR_RESPONSE_PORT = 14;

export enum Lifecycle {
    Worker,
    PendingTilling,
    Tilling,
    PendingSowing,
    Sowing,
    PendingHarvesting,
    Harvesting,
    Rebalancing,
}

export type MessageType = Lifecycle;

export type Payload = string | string[];

export type Message = ClientMessage<Lifecycle, Payload>;

export class MonitorClient extends Client<MessageType, Payload, void> {
    constructor(ns: NS) {
        super(ns, MONITOR_PORT, MONITOR_RESPONSE_PORT);
    }

    async worker(hostname: string) {
        await this.sendMessage(Lifecycle.Worker, hostname);
    }

    async pendingTilling(hostname: string) {
        await this.sendMessage(Lifecycle.PendingTilling, hostname);
    }

    async tilling(hostname: string) {
        await this.sendMessage(Lifecycle.Tilling, hostname);
    }

    async pendingSowing(hostname: string) {
        await this.sendMessage(Lifecycle.PendingSowing, hostname);
    }

    async sowing(hostname: string) {
        await this.sendMessage(Lifecycle.Sowing, hostname);
    }

    async pendingHarvesting(hostname: string) {
        await this.sendMessage(Lifecycle.PendingHarvesting, hostname);
    }

    async harvesting(hostname: string) {
        await this.sendMessage(Lifecycle.Harvesting, hostname);
    }

    async rebalancing(hostname: string) {
        await this.sendMessage(Lifecycle.Rebalancing, hostname);
    }
}
