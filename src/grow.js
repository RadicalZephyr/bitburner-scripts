/** @param {NS} ns */
export async function main(ns) {
  let target = ns.args[0];
  let moneyThreshold = ns.getServerMaxMoney(target) * 0.95;
  let securityThreshold = ns.getServerMinSecurityLevel(target) + 5;

  while (true) {
    if (ns.getServerSecurityLevel(target) > securityThreshold) {
      await ns.weaken(target);
    } else if (ns.getServerMoneyAvailable(target) < moneyThreshold) {
      await ns.grow(target, {"stock": true});
    } else {
      await ns.sleep(100);
    }
  }
}
