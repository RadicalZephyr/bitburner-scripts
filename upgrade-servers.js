import { formatGigaBytes, getHighestPurchasableRamLevel, reportServerComplementCost } from 'lib.js';

/** @param {NS} ns */
export async function main(ns) {
  let upgradeSpendPercentage = ns.args[0];
  upgradeSpendPercentage = upgradeSpendPercentage ? parseFloat(upgradeSpendPercentage) : 1.0;

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
    while (ns.getServerMoneyAvailable("home") < serverCost) {
      await ns.sleep(1000);
    }
    let hostname = ns.purchaseServer(serverName(ram), ram);
  }
  ns.run("startup.js");

  let ramOrderedServers = currentServers.map(host => {
    return { "host": host, ram: ns.getServerMaxRam(host) };
  }).sort((a, b) => a.ram - b.ram).map(hostRam => hostRam.host);

  // Upgrade all current servers to the new RAM tier
  for (let i = 0; i < ramOrderedServers.length; ++i) {
    let oldHostname = ramOrderedServers[i];

    // Make sure this is actually an upgrade
    if (ns.getServerMaxRam(oldHostname) < ram) {
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
  ns.run("startup.js");
}

function serverName(ram) {
  return "pserv" + formatGigaBytes(ram);
}
