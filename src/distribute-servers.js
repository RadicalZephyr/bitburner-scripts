/** @param {NS} ns */
export async function main(ns) {
  // Setup hackscript details
  let hackScript = "hack.js";
  let hackScriptMemory = ns.getScriptRam(hackScript);

  let foreignHosts = ns.read("foreignHosts.txt");
  let nearbyTargets = foreignHosts.filter(node => ns.hasRootAccess(node));
  let purchasedServers = ns.getPurchasedServers();

  for (let i = 0; i < purchasedServers.length; ++i) {
    let server = purchasedServers[i];
    let ram = ns.getServerMaxRam(server);
    let threads = Math.floor(ram / hackScriptMemory);
    let target = nearbyTargets[i % nearbyTargets.length];
    ns.killall(server);
    ns.exec(hackScript, server, threads, target);
    await ns.sleep(1000 * 10 + 1000 * 30 * Math.random());
  }
}
