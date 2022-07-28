import type { NS } from "netscript";

import { formatGigaBytes, getHighestPurchasableRamLevel, reportServerComplementCost } from './lib';

const startScript = "start.js";

export async function main(ns: NS) {
    const options = ns.flags([
        ['hack', false],
        ['spend', 1.0],
        ['wait', false],
        ['help', false]
    ]);

    if (options.help) {
        ns.tprint(`
Usage: ${ns.getScriptName()} [OPTIONS]

OPTIONS
  --help   Show this help message
  --spend  Percentage of money to spend on upgrading
  --wait   Wait for money to become available to buy servers
`);
        return;
    }

    let upgradeSpendPercentage = options.spend;

    // Find the highest amount of RAM we can purchase a full complement
    // of servers at right now
    let ram = getHighestPurchasableRamLevel(ns, upgradeSpendPercentage);
    reportServerComplementCost(ns, ram);

    let serverLimit = ns.getPurchasedServerLimit();
    let currentServers = ns.getPurchasedServers();

    // Buy as many new servers as we can
    let neededServers = serverLimit - currentServers.length;
    let serverCost = ns.getPurchasedServerCost(ram);
    for (let i = 0; i < neededServers; ++i) {
        if (options.hack && ns.getServerMoneyAvailable("home") < serverCost) {
            ns.run(startScript);
            if (!options.wait) return;
        }
        while (ns.getServerMoneyAvailable("home") < serverCost) {
            await ns.sleep(1000);
        }
        ns.purchaseServer(serverName(ram), ram);
    }

    if (options.hack) ns.run(startScript);

    let ramOrderedServers = currentServers.map(host => {
        return { "host": host, ram: ns.getServerMaxRam(host) };
    }).sort((a, b) => a.ram - b.ram).map(hostRam => hostRam.host);

    // Upgrade all current servers to the new RAM tier
    for (let i = 0; i < ramOrderedServers.length; ++i) {
        let oldHostname = ramOrderedServers[i];

        // Make sure this is actually an upgrade
        if (ns.getServerMaxRam(oldHostname) < ram) {
            if (options.hack && ns.getServerMoneyAvailable("home") < serverCost) {
                ns.run(startScript);
                if (!options.wait) return;
            }
            while (ns.getServerMoneyAvailable("home") < serverCost) {
                await ns.sleep(1000);
            }
            ns.killall(oldHostname);
            if (ns.deleteServer(oldHostname)) {
                // and if successful, buy an upgraded replacement
                let hostname = ns.purchaseServer(serverName(ram), ram);
            }
        }
        await ns.sleep(100);
    }

    if (options.hack) ns.run(startScript);
}

function serverName(ram: number) {
    return "pserv" + formatGigaBytes(ram);
}
