import { getHighestPurchasableRamLevel, reportServerComplementCost } from 'lib.js';

/** @param {NS} ns */
export async function main(ns) {
	let upgradeSpendPercentage = await ns.prompt("What percentage of your cash do you want to spend?", { "type": "text" });
	upgradeSpendPercentage = upgradeSpendPercentage ? parseFloat(upgradeSpendPercentage) : 1.0;
	let target = await ns.prompt("Which server would you like to target?", { "type": "text" });
	ns.tprint("what is target? ", target);
	if (!target) {
		ns.tprint("ERROR: must specify a hacking target")
		ns.exit();
	}
	// Setup hackscript details
	let hackScript = "hack.js";
	let hackScriptMemory = ns.getScriptRam(hackScript);

	// Find the highest amount of RAM we can purchase a full complement
	// of servers at right now
	let ram = getHighestPurchasableRamLevel(ns, upgradeSpendPercentage);
	reportServerComplementCost(ns, ram);

	// Figure out how many threads we can run the hack script 
	// with on this server tier
	let threads = Math.floor(ram / hackScriptMemory);

	let serverLimit = ns.getPurchasedServerLimit();
	let currentServers = ns.getPurchasedServers();

	// Buy as many new servers as we can
	let neededServers = serverLimit - currentServers.length;
	let serverCost = ns.getPurchasedServerCost(ram);
	for (let i = 0; i < neededServers; ++i) {
		while (ns.getServerMoneyAvailable("home") < serverCost) {
			await ns.sleep(1000);
		}
		let hostname = ns.purchaseServer("pserv-" + ram + "gb", ram);
		await ns.scp(hackScript, hostname);
		ns.exec(hackScript, hostname, threads, target);
	}

	// TODO: order old servers from least to most memory
	// Upgrade all current servers to the new RAM tier
	for (let i = 0; i < currentServers.length; ++i) {
		let oldHostname = currentServers[i];

		// Make sure this is actually an upgrade
		if (ns.getServerMaxRam(oldHostname) < ram) {
			while (ns.getServerMoneyAvailable("home") < serverCost) {
				await ns.sleep(1000);
			}
			ns.killall(oldHostname);
			if (ns.deleteServer(oldHostname)) {
				// and if successful, buy an upgraded replacement
				let hostname = ns.purchaseServer("pserv-" + ram + "gb", ram);

				await ns.scp(hackScript, hostname);
				ns.exec(hackScript, hostname, threads, target);
			}
		}
		await ns.sleep(100);
	}
}