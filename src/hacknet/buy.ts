import type { NS } from "netscript";

export async function main(ns: NS) {
    const budget = 0.25;
    const maxNodes = ns.hacknet.maxNumNodes();

    let ownedNodes = ns.hacknet.numNodes();
    let nextNodeCost = ns.hacknet.getPurchaseNodeCost();

    while (ownedNodes < maxNodes && nextNodeCost < ns.getServerMoneyAvailable('home') * budget) {
        const nodeIndex = ns.hacknet.purchaseNode();
        if (nodeIndex === -1) break;

        ++ownedNodes;

        const numLevels = 160;
        const levelUpgradeCost = ns.hacknet.getLevelUpgradeCost(nodeIndex, numLevels);

        if (levelUpgradeCost < ns.getServerMoneyAvailable('home')) {
            ns.hacknet.upgradeLevel(nodeIndex, numLevels);
        }

        const ramGB = 5;
        const ramUpgradeCost = ns.hacknet.getRamUpgradeCost(nodeIndex, ramGB);

        if (ramUpgradeCost < ns.getServerMoneyAvailable('home')) {
            ns.hacknet.upgradeRam(nodeIndex, ramGB);
        }

        const numCores = 4;
        const coreUpgradeCost = ns.hacknet.getCoreUpgradeCost(nodeIndex, numCores);

        if (coreUpgradeCost < ns.getServerMoneyAvailable('home')) {
            ns.hacknet.upgradeCore(nodeIndex, numCores);
        }
    }
}
