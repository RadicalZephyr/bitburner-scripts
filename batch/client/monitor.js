import { defineProtocol, BaseClient } from 'util/protocol';
import { isUnionOf, isArrayOf, isLiteral, isString, } from 'util/validate';
export const MONITOR_PORT = 13;
export const MONITOR_RESPONSE_PORT = 14;
export const Lifecycle = {
    Worker: 'Worker',
    PendingTilling: 'PendingTilling',
    Tilling: 'Tilling',
    PendingSowing: 'PendingSowing',
    Sowing: 'Sowing',
    PendingHarvesting: 'PendingHarvesting',
    Harvesting: 'Harvesting',
    Rebalancing: 'Rebalancing',
};
export const isLifecycle = isUnionOf(isLiteral(Lifecycle.Worker), isLiteral(Lifecycle.PendingTilling), isLiteral(Lifecycle.Tilling), isLiteral(Lifecycle.PendingSowing), isLiteral(Lifecycle.Sowing), isLiteral(Lifecycle.PendingHarvesting), isLiteral(Lifecycle.Harvesting), isLiteral(Lifecycle.Rebalancing));
const isHostPayload = isUnionOf(isString, isArrayOf(isString));
export const MonitorProtocol = defineProtocol({
    [Lifecycle.Worker]: { payload: isHostPayload },
    [Lifecycle.PendingTilling]: { payload: isHostPayload },
    [Lifecycle.Tilling]: { payload: isHostPayload },
    [Lifecycle.PendingSowing]: { payload: isHostPayload },
    [Lifecycle.Sowing]: { payload: isHostPayload },
    [Lifecycle.PendingHarvesting]: { payload: isHostPayload },
    [Lifecycle.Harvesting]: { payload: isHostPayload },
    [Lifecycle.Rebalancing]: { payload: isHostPayload },
});
export class MonitorClient {
    #client;
    constructor(ns) {
        this.#client = new BaseClient(MonitorProtocol, ns.getPortHandle(MONITOR_PORT), ns.getPortHandle(MONITOR_RESPONSE_PORT));
    }
    worker(hostnames) {
        return this.#client.sendMessage(Lifecycle.Worker, hostnames);
    }
    pendingTilling(hostnames) {
        return this.#client.sendMessage(Lifecycle.PendingTilling, hostnames);
    }
    tilling(hostnames) {
        return this.#client.sendMessage(Lifecycle.Tilling, hostnames);
    }
    pendingSowing(hostnames) {
        return this.#client.sendMessage(Lifecycle.PendingSowing, hostnames);
    }
    sowing(hostnames) {
        return this.#client.sendMessage(Lifecycle.Sowing, hostnames);
    }
    pendingHarvesting(hostnames) {
        return this.#client.sendMessage(Lifecycle.PendingHarvesting, hostnames);
    }
    harvesting(hostnames) {
        return this.#client.sendMessage(Lifecycle.Harvesting, hostnames);
    }
    rebalancing(hostnames) {
        return this.#client.sendMessage(Lifecycle.Rebalancing, hostnames);
    }
}
