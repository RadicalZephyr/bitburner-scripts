import type { NS } from '@ns';

import { defineProtocol, BaseClient } from 'util/protocol';
import {
    isUnionOf,
    isArrayOf,
    isLiteral,
    isString,
    Validator,
} from 'util/validate';

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
} as const;
export type Lifecycle = (typeof Lifecycle)[keyof typeof Lifecycle];

export const isLifecycle: Validator<Lifecycle> = isUnionOf(
    isLiteral(Lifecycle.Worker),
    isLiteral(Lifecycle.PendingTilling),
    isLiteral(Lifecycle.Tilling),
    isLiteral(Lifecycle.PendingSowing),
    isLiteral(Lifecycle.Sowing),
    isLiteral(Lifecycle.PendingHarvesting),
    isLiteral(Lifecycle.Harvesting),
    isLiteral(Lifecycle.Rebalancing),
);

type HostPayload = string | string[];

const isHostPayload: Validator<HostPayload> = isUnionOf(
    isString,
    isArrayOf(isString),
);

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

export type MonitorProtocolDef = (typeof MonitorProtocol)['def'];

export class MonitorClient {
    #client: BaseClient<MonitorProtocolDef>;

    constructor(ns: NS) {
        this.#client = new BaseClient(
            MonitorProtocol,
            ns.getPortHandle(MONITOR_PORT),
            ns.getPortHandle(MONITOR_RESPONSE_PORT),
        );
    }

    worker(hostnames: HostPayload) {
        return this.#client.sendMessage(Lifecycle.Worker, hostnames);
    }

    pendingTilling(hostnames: HostPayload) {
        return this.#client.sendMessage(Lifecycle.PendingTilling, hostnames);
    }

    tilling(hostnames: HostPayload) {
        return this.#client.sendMessage(Lifecycle.Tilling, hostnames);
    }

    pendingSowing(hostnames: HostPayload) {
        return this.#client.sendMessage(Lifecycle.PendingSowing, hostnames);
    }

    sowing(hostnames: HostPayload) {
        return this.#client.sendMessage(Lifecycle.Sowing, hostnames);
    }

    pendingHarvesting(hostnames: HostPayload) {
        return this.#client.sendMessage(Lifecycle.PendingHarvesting, hostnames);
    }

    harvesting(hostnames: HostPayload) {
        return this.#client.sendMessage(Lifecycle.Harvesting, hostnames);
    }

    rebalancing(hostnames: HostPayload) {
        return this.#client.sendMessage(Lifecycle.Rebalancing, hostnames);
    }
}
