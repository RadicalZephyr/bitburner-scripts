import type { NodeStats, NS } from "netscript";

export async function main(ns: NS) {
    const maxNodes = ns.hacknet.maxNumNodes();

    const budget = 0.25;

    const totalMoney = ns.getServerMoneyAvailable('home');
    const reserveMoney = totalMoney * (1 - budget);

    const targetLevel = 160;
    const targetRamLvl = 5;
    const targetCoreLvl = 4;

    let ownedNodes = ns.hacknet.numNodes();

    let nodes = Array(ownedNodes).map((_val, index) => ns.hacknet.getNodeStats(index));
    nodes.sort((a, b) => a.production - b.production);

    // Upgrade currently owned nodes to target levels
    while (ns.getServerMoneyAvailable('home') > reserveMoney) {
        for (let i = 0; i < ownedNodes; ++i) {

        }
    }

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

type Entry<T> = {
    key: number,
    value: T,
}

class Heap<T> {
    data: Entry<T>[],

    const() {
        this.data = [];
    }

    push(key: number, value: T) {
        const oldLen = this.data.length;
        this.data.push({ key: key, value: value });
        // TODO: Min heapify!
    }
}

function rebuild(data: NodeStats[]) {
    let n = Math.floor(data.length / 2);

    while (n > 0) {
        n -= 1;

        siftDown(data, n);
    }

}

function siftUp<T>(data: Entry<T>[], start: number, pos: number) {

}

function siftDown(data: Entry<T>[], pos: number) {
    siftDownRange(data, pos, data.length);
}

function siftDownRange(data: Entry<T>[], pos: number, end: number) {
    let child = 2 * pos + 1;

    while (child < end - 2) {

    }
}

function parent(index: number) {
    return Math.floor(index / 2);
}

function left(index: number) {
    return 2 * index;
}

function right(index: number) {
    return 2 * index + 1;
}
