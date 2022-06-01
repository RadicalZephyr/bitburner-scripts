/** @param {NS} ns */
export async function main(ns) {
	let nearbyNodes = ns.scan();

	let bestScore = 0.0;
	let bestNode = null;

	for (let i = 0; i < nearbyNodes.length; ++i) {
		let node = nearbyNodes[i];
		if (ns.hasRootAccess(node)) {
			
			let nodeMaxMoney = ns.getServerMaxMoney(node);
			let nodeMinSecurity = ns.getServerMinSecurityLevel(node);
			let nodeScore = nodeMaxMoney / nodeMinSecurity;

			if (nodeScore > bestScore) {
				bestScore = nodeScore;
				bestNode = node;
			}
		}
	}

	ns.tprint("best node to target is `%s" + bestNode + "`");
}