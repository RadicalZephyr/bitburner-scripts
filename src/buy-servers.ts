import type { NS } from "netscript";

import { MemoryClient } from "services/client/memory";

const DEFAULT_SPEND = 1.0;
const DEFAULT_MIN_RAM = 16;

export async function main(ns: NS) {
    const options = ns.flags([
        ['spend', DEFAULT_SPEND],
        ['min', DEFAULT_MIN_RAM],
        ['no-upgrade', false],
        ['dry-run', false],
        ['no-rename', false],
        ['wait', false],
        ['help', false]
    ]);

    if (
        options.help
        || typeof options.spend != 'number'
        || typeof options.min != 'number'
        || typeof options['no-upgrade'] != 'boolean'
        || typeof options['dry-run'] != 'boolean'
        || typeof options['no-rename'] != 'boolean'
        || typeof options.wait != 'boolean'
    ) {
        ns.tprint(`
Usage: ${ns.getScriptName()} [OPTIONS]

OPTIONS
  --min         The minimum amount of RAM to purchase servers at (default ${ns.formatRam(DEFAULT_MIN_RAM)})
  --spend       Percentage of money to spend on upgrading (default ${ns.formatPercent(DEFAULT_SPEND)})
  --dry-run     Print out the number and tier of servers you could buy but don't actually buy anything
  --no-upgrade  Don't upgrade existing servers
  --no-rename   Don't rename the newly purchased servers
  --wait        Wait for money to become available to buy servers
  --help        Show this help message
`);
        return;
    }

    const shouldRenameServers = !options['no-rename'];

    let upgradeSpendPercentage = options.spend;

    // Find the highest amount of RAM we can purchase a full complement
    // of servers at right now
    let ram = getHighestPurchasableRamLevel(ns, options.min, upgradeSpendPercentage);
    reportServerComplementCost(ns, ram);

    if (options['dry-run']) return;

    let memoryClient = new MemoryClient(ns);

    let serverLimit = ns.getPurchasedServerLimit();
    let currentServers = ns.getPurchasedServers();

    // Buy as many new servers as we can
    let neededServers = serverLimit - currentServers.length;
    let serverCost = ns.getPurchasedServerCost(ram);

    for (let i = 0; i < neededServers; ++i) {
        if (ns.getServerMoneyAvailable("home") < serverCost) {
            if (!options.wait) return;
        }
        while (ns.getServerMoneyAvailable("home") < serverCost) {
            await ns.sleep(1000);
        }

        let hostname = ns.purchaseServer(serverName(ram), ram);
        if (hostname !== "") {
            await memoryClient.newWorker(hostname);
        }
    }

    let ramOrderedServers = currentServers
        .map(host => {
            return { "host": host, ram: ns.getServerMaxRam(host) };
        })
        .filter(h => h.ram < ram)
        .sort((a, b) => a.ram - b.ram)
        .map(hostRam => hostRam.host);

    if (options['no-upgrade']) {
        ns.tprint(`not upgrading existing ${ramOrderedServers.length} servers with less than ${ns.formatRam(ram)} of RAM`);
        return;
    }

    // Upgrade all current servers to the new RAM tier
    for (let i = 0; i < ramOrderedServers.length; ++i) {
        let oldHostname = ramOrderedServers[i];

        // Make sure this is actually an upgrade
        if (ns.getServerMaxRam(oldHostname) < ram) {
            const serverCost = ns.getPurchasedServerUpgradeCost(oldHostname, ram);
            if (ns.getServerMoneyAvailable("home") < serverCost) {
                if (!options.wait) return;
            }
            while (ns.getServerMoneyAvailable("home") < serverCost) {
                await ns.sleep(1000);
            }
            let upgradeResult = ns.upgradePurchasedServer(oldHostname, ram);
            if (upgradeResult) {
                let newHostname = serverName(ram);
                if (shouldRenameServers && ns.renamePurchasedServer(oldHostname, newHostname)) {
                    await memoryClient.newWorker(newHostname);
                }
            }
        }
        await ns.sleep(100);
    }
}

function serverName(ram: number) {
    return "pserv" + formatGigaBytes(ram);
}

function formatGigaBytes(value: number): string {
    var s = ['GB', 'TB', 'PB'];
    var e = Math.floor(Math.log(value) / Math.log(1024));
    return (value / Math.pow(1024, e)).toFixed(0) + s[e];
}

/** Return the maximum amount of ram that can be purchased.
 */
function getHighestPurchasableRamLevel(ns: NS, minRam: number, percentageSpend: number): number {
    let maxServers = ns.getPurchasedServerLimit();
    let maxServerTierSpend = ns.getServerMoneyAvailable("home") * percentageSpend;
    let maxPerServerSpend = maxServerTierSpend / maxServers;

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
    let maxServers = ns.getPurchasedServerLimit();
    let serverCost = ns.getPurchasedServerCost(ram);
    let totalCost = maxServers * serverCost;
    ns.tprint(`you can buy ${maxServers} servers with ${ns.formatRam(ram)} of RAM for $${ns.formatNumber(serverCost)} per server for a total of $${ns.formatNumber(totalCost)}`);
}
