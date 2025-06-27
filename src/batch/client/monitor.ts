import type { NS, NetscriptPort } from "netscript";

import { MONITOR_PORT } from "util/ports";


export enum Lifecycle {
    PendingTilling,
    Tilling,
    PendingSowing,
    Sowing,
    PendingHarvesting,
    Harvesting,
    Rebalancing,
}

export type Message = [lifecycle: Lifecycle, host: string];

export class MonitorClient {
    ns: NS;
    port: NetscriptPort;

    constructor(ns: NS) {
        this.ns = ns;
        this.port = ns.getPortHandle(MONITOR_PORT);
    }

    async pendingTilling(hostname: string) {
        await this.send(Lifecycle.PendingTilling, hostname);
    }

    async tilling(hostname: string) {
        await this.send(Lifecycle.Tilling, hostname);
    }

    async pendingSowing(hostname: string) {
        await this.send(Lifecycle.PendingSowing, hostname);
    }

    async sowing(hostname: string) {
        await this.send(Lifecycle.Sowing, hostname);
    }

    async pendingHarvesting(hostname: string) {
        await this.send(Lifecycle.PendingHarvesting, hostname);
    }

    async harvesting(hostname: string) {
        await this.send(Lifecycle.Harvesting, hostname);
    }

    async rebalancing(hostname: string) {
        await this.send(Lifecycle.Rebalancing, hostname);
    }

    private async send(lifecycle: Lifecycle, host: string) {
        const message: Message = [lifecycle, host];
        while (!this.port.tryWrite(message)) {
            await this.ns.sleep(200);
        }
    }
}
