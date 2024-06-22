import type { NS } from "netscript";

import { Heap } from '../lib';

export async function main(ns: NS) {
    const options = ns.flags([
        ['help', false],
        ['budget', 0.25],
        ['level', 180],
        ['ram', 32],
        ['cores', 5]
    ]);

    if (
        options.help
        || typeof options.budget != 'number'
        || typeof options.level != 'number'
        || typeof options.ram != 'number'
        || typeof options.cores != 'number'
    ) {
        ns.tprint(`
Usage: ${ns.getScriptName()} [OPTIONS]

OPTIONS
  --help    Show this help message
  --budget  Percentage of current money to spend
  --level   Target levels to buy for all nodes
  --ram     Target ram (GB) to buy for all nodes
  --cores   Target cores to buy for all nodes
`);
        return;
    }

    const budget = options.budget;

    const totalMoney = ns.getServerMoneyAvailable('home');
    const reserveMoney = totalMoney * (1 - budget);

    const targetLevel = options.level;
    const targetRam = options.ram;
    const targetCores = options.cores;

    let ownedNodes = ns.hacknet.numNodes();

    // Upgrade current nodes before buying new ones
    if (ownedNodes > 0) {
        let nodes = [...new Array(ownedNodes).keys()];

        let nodeLevelHeap = new Heap(nodes, nodeIndex => ns.hacknet.getNodeStats(nodeIndex).level);
        // Upgrade currently owned nodes to target levels
        while (ns.getServerMoneyAvailable('home') > reserveMoney) {
            let minLevelNode = nodeLevelHeap.min();

            let currentLevel = ns.hacknet.getNodeStats(minLevelNode).level;
            if (currentLevel >= targetLevel) break;

            if (!ns.hacknet.upgradeLevel(minLevelNode, 1)) break;
            nodeLevelHeap.updateMinKey();

            await ns.sleep(1);
        }

        let nodeRamHeap = new Heap(nodes, nodeIndex => ns.hacknet.getNodeStats(nodeIndex).ram);
        while (ns.getServerMoneyAvailable('home') > reserveMoney) {
            let minRamNode = nodeRamHeap.min();

            let currentRam = ns.hacknet.getNodeStats(minRamNode).ram;
            if (currentRam >= targetRam) break;

            if (!ns.hacknet.upgradeRam(minRamNode, 1)) break;
            nodeRamHeap.updateMinKey();

            await ns.sleep(1);
        }

        let nodeCoreHeap = new Heap(nodes, nodeIndex => ns.hacknet.getNodeStats(nodeIndex).cores);
        while (ns.getServerMoneyAvailable('home') > reserveMoney) {
            let minCoreNode = nodeCoreHeap.min();

            let currentCores = ns.hacknet.getNodeStats(minCoreNode).cores;
            if (currentCores >= targetCores) break;

            if (!ns.hacknet.upgradeCore(minCoreNode, 1)) break;
            nodeCoreHeap.updateMinKey();

            await ns.sleep(1);
        }
    }

    const maxNodes = ns.hacknet.maxNumNodes();

    let nextNodeCost = ns.hacknet.getPurchaseNodeCost();
    while (ownedNodes <= maxNodes && ns.getServerMoneyAvailable('home') - nextNodeCost > reserveMoney) {
        const nodeIndex = ns.hacknet.purchaseNode();
        if (nodeIndex === -1) break;

        ++ownedNodes;
        nextNodeCost = ns.hacknet.getPurchaseNodeCost();

        let nextLevelCost = ns.hacknet.getLevelUpgradeCost(nodeIndex, 1);
        while (ns.getServerMoneyAvailable('home') - nextLevelCost > reserveMoney) {
            if (!ns.hacknet.upgradeLevel(nodeIndex, 1)) return;
            nextLevelCost = ns.hacknet.getLevelUpgradeCost(nodeIndex, 1);

            let currentLevel = ns.hacknet.getNodeStats(nodeIndex).level;
            if (currentLevel >= targetLevel) break;

            await ns.sleep(1);
        }

        let nextRamCost = ns.hacknet.getRamUpgradeCost(nodeIndex, 1);
        while (ns.getServerMoneyAvailable('home') - nextRamCost > reserveMoney) {
            if (!ns.hacknet.upgradeRam(nodeIndex, 1)) return;
            nextRamCost = ns.hacknet.getRamUpgradeCost(nodeIndex, 1);

            let currentRam = ns.hacknet.getNodeStats(nodeIndex).ram;
            if (currentRam >= targetRam) break;

            await ns.sleep(1);
        }

        let nextCoreCost = ns.hacknet.getCoreUpgradeCost(nodeIndex, 1);
        while (ns.getServerMoneyAvailable('home') - nextCoreCost > reserveMoney) {
            if (!ns.hacknet.upgradeCore(nodeIndex, 1)) return;
            nextCoreCost = ns.hacknet.getCoreUpgradeCost(nodeIndex, 1);

            let currentCores = ns.hacknet.getNodeStats(nodeIndex).cores;
            if (currentCores >= targetCores) break;

            await ns.sleep(1);
        }

        await ns.sleep(1);
    }
}
