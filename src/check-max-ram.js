import { formatGigaBytes, getHighestPurchasableRamLevel, reportServerComplementCost } from './lib.js';

/** @param {NS} ns */
export async function main(ns) {
  const percentSpend = ns.args[0] ? ns.args[0] : 1.0;
  const ram = getHighestPurchasableRamLevel(ns, percentSpend);
  reportServerComplementCost(ns, ram);
  ns.tprintf("highest possible RAM purchase is %s", formatGigaBytes(ns.getPurchasedServerMaxRam()));
}
