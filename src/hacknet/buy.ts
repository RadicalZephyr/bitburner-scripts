import type { NodeStats, NS } from "netscript";

export async function main(ns: NS) {
    const budget = 0.25;

    const totalMoney = ns.getServerMoneyAvailable('home');
    const reserveMoney = totalMoney * (1 - budget);

    const targetLevel = 180;
    const targetRam = 32;
    const targetCore = 5;

    let ownedNodes = ns.hacknet.numNodes();

    let nodes = [...new Array(ownedNodes).keys()];

    let nodeLevelHeap = new Heap(nodes, nodeIndex => ns.hacknet.getNodeStats(nodeIndex).level);
    // Upgrade currently owned nodes to target levels
    while (ns.getServerMoneyAvailable('home') > reserveMoney) {
        let minLevelNode = nodeLevelHeap.min();

        let currentLevel = ns.hacknet.getNodeStats(minLevelNode).level;
        if (currentLevel >= targetLevel) break;

        if (!ns.hacknet.upgradeLevel(minLevelNode, 1)) break;
        nodeLevelHeap.updateMinKey();
    }

    let nodeRamHeap = new Heap(nodes, nodeIndex => ns.hacknet.getNodeStats(nodeIndex).ram);
    while (ns.getServerMoneyAvailable('home') > reserveMoney) {
        let minRamNode = nodeRamHeap.min();

        let currentRam = ns.hacknet.getNodeStats(minRamNode).ram;
        if (currentRam >= targetRam) break;

        if (!ns.hacknet.upgradeRam(minRamNode, 1)) break;
        nodeRamHeap.updateMinKey();
    }

    let nodeCoreHeap = new Heap(nodes, nodeIndex => ns.hacknet.getNodeStats(nodeIndex).cores);
    while (ns.getServerMoneyAvailable('home') > reserveMoney) {
        let minCoreNode = nodeCoreHeap.min();

        let currentCores = ns.hacknet.getNodeStats(minCoreNode).cores;
        if (currentCores >= targetCore) break;

        if (!ns.hacknet.upgradeCore(minCoreNode, 1)) break;
        nodeRamHeap.updateMinKey();
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
        }

        let nextRamCost = ns.hacknet.getRamUpgradeCost(nodeIndex, 1);
        while (ns.getServerMoneyAvailable('home') - nextRamCost > reserveMoney) {
            if (!ns.hacknet.upgradeRam(nodeIndex, 1)) return;
            nextRamCost = ns.hacknet.getRamUpgradeCost(nodeIndex, 1);

            let currentRam = ns.hacknet.getNodeStats(nodeIndex).ram;
            if (currentRam >= targetRam) break;
        }

        let nextCoreCost = ns.hacknet.getCoreUpgradeCost(nodeIndex, 1);
        while (ns.getServerMoneyAvailable('home') - nextCoreCost > reserveMoney) {
            if (!ns.hacknet.upgradeCore(nodeIndex, 1)) return;
            nextCoreCost = ns.hacknet.getCoreUpgradeCost(nodeIndex, 1);

            let currentCores = ns.hacknet.getNodeStats(nodeIndex).cores;
            if (currentCores >= targetCore) break;
        }
    }
}


type Entry<T> = {
    key: number,
    value: T,
}

class Heap<T> {
    data: Entry<T>[];
    keyFn: ((v: T) => number);

    constructor(values: T[], keyFn: ((v: T) => number)) {
        let data = values.map(v => { return { key: keyFn(v), value: v }; });
        buildMinHeap(data);
        this.data = data;
        this.keyFn = keyFn;
    }

    length(): number {
        return this.data.length;
    }

    pop(): T {
        if (this.data.length > 1) {
            const min = this.data[0].value;
            let last = this.data.pop();
            this.data[0] = last;
            minHeapify(this.data, 0);
            return min;
        } else if (this.data.length == 1) {
            return this.data.pop().value;
        }
    }

    min(): T {
        if (this.data.length > 0) {
            return this.data[0].value;
        }
    }

    updateMinKey() {
        if (this.data.length <= 0) return;

        let min = this.data[0];
        min.key = this.keyFn(min.value);
        minHeapify(this.data, 0);
    }
}

function buildMinHeap<T>(A: Entry<T>[]) {
    const last = A.length - 1;
    for (let i = parent(last); i >= 0; --i) {
        minHeapify(A, i);
    }

}

function minHeapify<T>(A: Entry<T>[], i: number) {
    const l = left(i);
    const r = right(i);

    let smallest;
    if (l < A.length && A[l].key < A[i].key) {
        smallest = l;
    } else {
        smallest = i;
    }

    if (r < A.length && A[r].key < A[smallest].key) {
        smallest = r;
    }

    if (smallest != i) {
        const temp = A[i];
        A[i] = A[smallest];
        A[smallest] = temp;
        minHeapify(A, smallest);
    }
}

function parent(index: number) {
    return Math.floor((index - 1) / 2);
}

function left(index: number) {
    return 2 * index + 1;
}

function right(index: number) {
    return 2 * index + 2;
}
