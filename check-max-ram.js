import { getHighestPurchasableRamLevel, reportServerComplementCost } from 'lib.js';

/** @param {NS} ns */
export async function main(ns) {
	let ram = getHighestPurchasableRamLevel(ns, ns.args[0]);
	reportServerComplementCost(ns, ram);
}