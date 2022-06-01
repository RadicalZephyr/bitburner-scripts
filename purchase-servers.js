/** @param {NS} ns */
export async function main(ns) {
  let target = ns.args[0];
  let ram = ns.args[1];
  let hackScript = "hack.js";
  let hackScriptMemory = ns.getScriptRam(hackScript);

  let serverCost = ns.getPurchasedServerCost(ram);
  ns.printf("current server cost: %s", serverCost);
  let threads = Math.floor(ram / hackScriptMemory);

  let i = ns.getPurchasedServers().length;
  while (i < ns.getPurchasedServerLimit()) {

    if (ns.getServerMoneyAvailable("home") > serverCost) {
      let hostname = ns.purchaseServer("pserv-" + ram + "-0", ram);
      await ns.scp("hack.js", hostname);
      ns.exec(hackScript, hostname, threads, target);
    }
    await ns.sleep(5000);
  }
}
