import type { NS } from "netscript";

const startScript = "start.js";

const DEFAULT_SPEND = 1.0;
const DEFAULT_MIN_RAM = 8;

export async function main(ns: NS) {
    const options = ns.flags([
        ['start', false],
        ['spend', DEFAULT_SPEND],
        ['min_ram', DEFAULT_MIN_RAM],
        ['wait', false],
        ['help', false]
    ]);

    if (options.help) {
        ns.tprint(`
Usage: ${ns.getScriptName()} [OPTIONS]

OPTIONS
  --min_ram  The minimum amount of RAM to purchase servers at (default ${formatGigaBytes(DEFAULT_MIN_RAM)})
  --start    Run the start script after purchasing servers
  --spend    Percentage of money to spend on upgrading (default ${ns.nFormat(DEFAULT_SPEND, '0.00%')})
  --wait     Wait for money to become available to buy servers
  --help     Show this help message
`);
        return;
    }

    let upgradeSpendPercentage = options.spend;

    // Find the highest amount of RAM we can purchase a full complement
    // of servers at right now
    let ram = getHighestPurchasableRamLevel(ns, options.min_ram, upgradeSpendPercentage);
    reportServerComplementCost(ns, ram);

    let serverLimit = ns.getPurchasedServerLimit();
    let currentServers = ns.getPurchasedServers();

    // Buy as many new servers as we can
    let neededServers = serverLimit - currentServers.length;
    let serverCost = ns.getPurchasedServerCost(ram);

    for (let i = 0; i < neededServers; ++i) {
        if (ns.getServerMoneyAvailable("home") < serverCost) {
            if (options.start) ns.run(startScript);
            if (!options.wait) return;
        }
        while (ns.getServerMoneyAvailable("home") < serverCost) {
            await ns.sleep(1000);
        }
        ns.purchaseServer(serverName(ram), ram);
    }

    if (options.start) ns.run(startScript);

    let ramOrderedServers = currentServers.map(host => {
        return { "host": host, ram: ns.getServerMaxRam(host) };
    }).sort((a, b) => a.ram - b.ram).map(hostRam => hostRam.host);

    // Upgrade all current servers to the new RAM tier
    for (let i = 0; i < ramOrderedServers.length; ++i) {
        let oldHostname = ramOrderedServers[i];

        // Make sure this is actually an upgrade
        if (ns.getServerMaxRam(oldHostname) < ram) {
            if (ns.getServerMoneyAvailable("home") < serverCost) {
                if (options.start) ns.run(startScript);
                if (!options.wait) return;
            }
            while (ns.getServerMoneyAvailable("home") < serverCost) {
                await ns.sleep(1000);
            }
            ns.killall(oldHostname);
            if (ns.deleteServer(oldHostname)) {
                // and if successful, buy an upgraded replacement
                ns.purchaseServer(serverName(ram), ram);
            }
        }
        await ns.sleep(100);
    }

    if (options.start) ns.run(startScript);
}

function serverName(ram: number) {
    return "pserv" + formatGigaBytes(ram);
}

/** Print the cost breakdown of a server tier with `ram` memory.
 */
export function reportServerComplementCost(ns: NS, ram: number): void {
    let maxServers = ns.getPurchasedServerLimit();
    let serverCost = ns.getPurchasedServerCost(ram);
    let totalCost = maxServers * serverCost;
    ns.tprint("you can buy ", maxServers, " servers with ",
        formatGigaBytes(ram), " of RAM for $",
        formatMoney(serverCost), " per server ",
        "for a total of $", formatMoney(totalCost),
    );
}

/** Return the maximum amount of ram that can be purchased.
 */
export function getHighestPurchasableRamLevel(ns: NS, minRam: number, percentageSpend: number): number {
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

export function formatMoney(value: number): string {
    var s = ['', 'k', 'm', 'b', 't', 'q'];
    var e = Math.floor(Math.log(value) / Math.log(1000));
    return (value / Math.pow(1000, e)).toFixed(2) + s[e];
}


export function formatGigaBytes(value: number): string {
    var s = ['GB', 'TB', 'PB'];
    var e = Math.floor(Math.log(value) / Math.log(1024));
    return (value / Math.pow(1024, e)).toFixed(0) + s[e];
}
