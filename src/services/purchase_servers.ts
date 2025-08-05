import type { AutocompleteData, NS } from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

import { MemoryClient } from 'services/client/memory';
import {
    SERVER_PURCHASE_PORT,
    SERVER_PURCHASE_RESPONSE_PORT,
    Message,
    MessageType,
    BuyOrderCommand,
    SetUrgencyCommand,
} from 'services/client/server_purchase';
import { readAllFromPort, readLoop } from 'util/ports';

const FLAGS = [['help', false]] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

/**
 * Scale a base interval by urgency percentage.
 *
 * @param base - Base interval in milliseconds
 * @param urgency - Urgency percentage (1-100)
 * @returns Scaled interval in milliseconds
 */
export function calculateCheckInterval(base: number, urgency: number): number {
    const clamped = Math.min(Math.max(Math.floor(urgency), 1), 100);
    return base * (100 / clamped);
}

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    if (flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

Daemon that purchases and upgrades player-owned servers.

OPTIONS
  --help   Show this help message

CONFIGURATION
  DISCOVERY_minRamDoublings     Minimum power-of-two jump between upgrades
  DISCOVERY_maxPaybackTimeSec   Maximum upgrade payback window versus hack income
  DISCOVERY_baseCheckIntervalMs Baseline loop delay before urgency scaling
`);
        return;
    }

    ns.disableLog('sleep');

    const { CONFIG } = await import('services/config');

    const memClient = new MemoryClient(ns);
    const self = ns.self();
    memClient.registerAllocation(self.server, self.ramUsage, 1);

    let active = false;
    let urgency = 100;

    const port = ns.getPortHandle(SERVER_PURCHASE_PORT);
    const _respPort = ns.getPortHandle(SERVER_PURCHASE_RESPONSE_PORT);
    void _respPort;

    readLoop(ns, port, async () => {
        for (const next of readAllFromPort(ns, port)) {
            const msg = next as Message;
            switch (msg[0]) {
                case MessageType.BuyOrder: {
                    const payload = msg[2] as BuyOrderCommand;
                    active = payload.state;
                    break;
                }
                case MessageType.SetUrgency: {
                    const payload = msg[2] as SetUrgencyCommand;
                    if (typeof payload.urgency === 'number') {
                        urgency = Math.min(
                            Math.max(Math.floor(payload.urgency), 1),
                            100,
                        );
                    }
                    break;
                }
            }
        }
    });

    while (true) {
        if (active) {
            const [incomePerSec] = ns.getTotalScriptIncome();
            if (incomePerSec > 0) {
                const tier = determineNextTier(
                    ns,
                    incomePerSec,
                    urgency,
                    CONFIG,
                );
                if (
                    tier !== null
                    && ns.getServerMoneyAvailable('home') >= tier.cost
                ) {
                    await purchaseComplement(ns, tier.ram, memClient);
                }
            }
        }
        await ns.sleep(
            calculateCheckInterval(CONFIG.baseCheckIntervalMs, urgency),
        );
    }
}

interface TierInfo {
    ram: number;
    cost: number;
}

function determineNextTier(
    ns: NS,
    incomePerSec: number,
    urgency: number,
    config: { minRamDoublings: number; maxPaybackTimeSec: number },
): TierInfo | null {
    const servers = ns.getPurchasedServers();
    const currentMax = servers.reduce(
        (m, h) => Math.max(m, ns.getServerMaxRam(h)),
        0,
    );
    const maxLimit = ns.getPurchasedServerMaxRam();
    let ram =
        currentMax === 0
            ? 2 ** config.minRamDoublings
            : currentMax * 2 ** config.minRamDoublings;
    const paybackLimit = config.maxPaybackTimeSec * (urgency / 100);

    while (ram <= maxLimit) {
        const cost = computeComplementCost(ns, ram);
        if (incomePerSec > 0 && cost / incomePerSec <= paybackLimit) {
            return { ram, cost };
        }
        ram *= 2;
    }
    return null;
}

function computeComplementCost(ns: NS, ram: number): number {
    const serverLimit = ns.getPurchasedServerLimit();
    const current = ns.getPurchasedServers();
    const purchaseCost = ns.getPurchasedServerCost(ram);
    let total = (serverLimit - current.length) * purchaseCost;
    for (const host of current) {
        const have = ns.getServerMaxRam(host);
        if (have < ram) {
            total += ns.getPurchasedServerUpgradeCost(host, ram);
        }
    }
    return total;
}

async function purchaseComplement(
    ns: NS,
    ram: number,
    memClient: MemoryClient,
) {
    const serverLimit = ns.getPurchasedServerLimit();
    const current = ns.getPurchasedServers();
    for (let i = current.length; i < serverLimit; ++i) {
        const hostname = ns.purchaseServer(serverName(i), ram);
        if (hostname !== '') {
            await memClient.newWorker(hostname);
        }
    }

    for (const host of current) {
        if (ns.getServerMaxRam(host) < ram) {
            ns.upgradePurchasedServer(host, ram);
        }
        await ns.sleep(100);
    }
}

function serverName(i: number) {
    return `pserv-${i + 1}`;
}
