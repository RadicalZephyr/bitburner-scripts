import type { AutocompleteData, NS } from 'netscript';
import { ALLOC_ID, MEM_TAG_FLAGS } from 'services/client/memory_tag';
import { parseAndRegisterAlloc } from 'services/client/memory';
import { FlagsSchema } from 'util/flags';

import { MemoryClient } from 'services/client/memory';

const DEFAULT_SPEND = 1.0;
const DEFAULT_MIN_RAM = 16;

const FLAGS = [
    ['spend', DEFAULT_SPEND],
    ['min', DEFAULT_MIN_RAM],
    ['no-upgrade', false],
    ['dry-run', false],
    ['wait', false],
    ['help', false],
] satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

export async function main(ns: NS) {
    const options = ns.flags([...FLAGS, ...MEM_TAG_FLAGS]);

    if (
        options.help
        || typeof options.spend != 'number'
        || typeof options.min != 'number'
        || typeof options['no-upgrade'] != 'boolean'
        || typeof options['dry-run'] != 'boolean'
        || typeof options.wait != 'boolean'
    ) {
        ns.tprint(`
Usage: ${ns.getScriptName()} [OPTIONS]

OPTIONS
  --min         The minimum amount of RAM to purchase servers at (default ${ns.formatRam(DEFAULT_MIN_RAM)})
  --spend       Percentage of money to spend on upgrading (default ${ns.formatPercent(DEFAULT_SPEND)})
  --dry-run     Print out the number and tier of servers you could buy but don't actually buy anything
  --no-upgrade  Don't upgrade existing servers
  --wait        Wait for money to become available to buy servers
  --help        Show this help message
`);
        return;
    }

    const allocationId = await parseAndRegisterAlloc(ns, options);
    if (options[ALLOC_ID] !== -1 && allocationId === null) {
        return;
    }

    const upgradeSpendPercentage = options.spend;

    // Find the highest amount of RAM we can purchase a full complement
    // of servers at right now
    const ram = getHighestPurchasableRamLevel(
        ns,
        options.min,
        upgradeSpendPercentage,
    );
    reportServerComplementCost(ns, ram);

    if (options['dry-run']) return;

    const memoryClient = new MemoryClient(ns);

    const serverLimit = ns.getPurchasedServerLimit();
    const currentServers = ns.getPurchasedServers();

    const serverCost = ns.getPurchasedServerCost(ram);

    for (let i = currentServers.length; i < serverLimit; ++i) {
        if (ns.getServerMoneyAvailable('home') < serverCost) {
            if (!options.wait) return;
        }
        while (ns.getServerMoneyAvailable('home') < serverCost) {
            await ns.sleep(1000);
        }

        const hostname = ns.purchaseServer(serverName(i), ram);
        if (hostname !== '') {
            await memoryClient.newWorker(hostname);
        }
    }

    const ramOrderedServers = currentServers
        .map((host) => {
            return { host: host, ram: ns.getServerMaxRam(host) };
        })
        .filter((h) => h.ram < ram)
        .sort((a, b) => a.ram - b.ram)
        .map((hostRam) => hostRam.host);

    if (options['no-upgrade']) {
        ns.tprint(
            `not upgrading existing ${ramOrderedServers.length} servers with less than ${ns.formatRam(ram)} of RAM`,
        );
        return;
    }

    // Upgrade all current servers to the new RAM tier
    for (let i = 0; i < ramOrderedServers.length; ++i) {
        const oldHostname = ramOrderedServers[i];

        // Make sure this is actually an upgrade
        if (ns.getServerMaxRam(oldHostname) < ram) {
            const serverCost = ns.getPurchasedServerUpgradeCost(
                oldHostname,
                ram,
            );
            if (ns.getServerMoneyAvailable('home') < serverCost) {
                if (!options.wait) return;
            }
            while (ns.getServerMoneyAvailable('home') < serverCost) {
                await ns.sleep(1000);
            }
            ns.upgradePurchasedServer(oldHostname, ram);
        }
        await ns.sleep(100);
    }
}

function serverName(i: number) {
    return `pserv-${i + 1}`;
}

/** Return the maximum amount of ram that can be purchased.
 */
function getHighestPurchasableRamLevel(
    ns: NS,
    minRam: number,
    percentageSpend: number,
): number {
    const maxServers = ns.getPurchasedServerLimit();
    const maxServerTierSpend =
        ns.getServerMoneyAvailable('home') * percentageSpend;
    const maxPerServerSpend = maxServerTierSpend / maxServers;

    // Double minimum RAM so return division returns the right amount
    let ram = minRam * 2;

    while (maxPerServerSpend > ns.getPurchasedServerCost(ram)) {
        ram *= 2;
    }

    return ram / 2;
}

/** Print the cost breakdown of a server tier with `ram` memory.
 */
export function reportServerComplementCost(ns: NS, ram: number): void {
    const maxServers = ns.getPurchasedServerLimit();
    const serverCost = ns.getPurchasedServerCost(ram);
    const totalCost = maxServers * serverCost;
    ns.tprint(
        `you can buy ${maxServers} servers with ${ns.formatRam(ram)} of RAM for $${ns.formatNumber(serverCost)} per server for a total of $${ns.formatNumber(totalCost)}`,
    );
}
