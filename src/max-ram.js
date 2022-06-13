import { formatGigaBytes, getHighestPurchasableRamLevel, reportServerComplementCost } from "./lib.js";

/** @param {NS} ns */
export async function main(ns) {
  let ram = getHighestPurchasableRamLevel(ns, 1.0);
  reportServerComplementCost(ns, ram);
  ns.tprintf("highest possible RAM purchase is %s", formatGigaBytes(ns.getPurchasedServerMaxRam()));
}
