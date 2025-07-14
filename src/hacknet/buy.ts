import type { NS } from "netscript";

import { CONFIG } from "hacknet/config";

const DEFAULT_RETURN_TIME = 2;
const DEFAULT_SPEND = 1;

export async function main(ns: NS) {
    const flags = ns.flags([
        ["return-time", DEFAULT_RETURN_TIME],
        ["spend", DEFAULT_SPEND],
        ["help", false],
    ]);

    if (
        flags.help ||
        typeof flags["return-time"] !== "number" ||
        flags["return-time"] <= 0 ||
        typeof flags.spend !== "number" ||
        flags.spend < 0 ||
        flags.spend > 1
    ) {
        ns.tprint(`
Usage: run ${ns.getScriptName()} [--return-time HOURS] [--spend 0-1] [--help]

Buy hacknet nodes/servers and upgrades that can pay for themselves within a time limit.

OPTIONS
  --return-time  Desired payback time window (default ${DEFAULT_RETURN_TIME} hours)
  --spend        Portion of money to spend (default ${ns.formatPercent(DEFAULT_SPEND)})
  --help         Display this message
`);
        return;
    }

    const returnTimeSeconds = flags["return-time"] * 60 * 60;
    let totalSpend = ns.getServerMoneyAvailable("home") * flags.spend;
    ns.print(`INFO: starting with budget $${ns.formatNumber(totalSpend)} and payback time ${ns.tFormat(returnTimeSeconds * 1000)}`);

    let budget: Budget = {
        total: totalSpend,
        remaining: totalSpend
    };

    while (true) {
        const currentGain = calculateCurrentGain(ns);
        const candidates = [newNodeCandidate(ns, currentGain)];

        const numNodes = ns.hacknet.numNodes();

        for (let i = 0; i < numNodes; i++) {
            candidates.push(upgradeLevelCandidate(ns, i, currentGain));
            candidates.push(upgradeRamCandidate(ns, i, currentGain));
            candidates.push(upgradeCoreCandidate(ns, i, currentGain));
        }

        const allCandidates = candidates.map(c => upgradeDescription(ns, c)).join("\n  ");
        ns.print(`all candidates:\n  ${allCandidates}`);

        const best = candidates.reduce((best, next) => bestCandidate(best, next));

        ns.print(`found best candidate: ${upgradeDescription(ns, best)}`);

        if (best.cost > budget.remaining || best.paybackTime > returnTimeSeconds) break;

        purchaseCandidate(ns, budget, best);

        await ns.sleep(0);
    }
}

function calculateCurrentGain(ns: NS): number {
    const numNodes = ns.hacknet.numNodes();
    let total = 0;
    for (let i = 0; i < numNodes; i++) {
        const stats = ns.hacknet.getNodeStats(i);
        total += stats.production;
    }
    return total;
}

function calculateMoneyGainRate(level: number, ram: number, cores: number, mult: number = 1): number {
    const gainPerLevel = 1.5;

    const levelMult = level * gainPerLevel;
    const ramMult = Math.pow(1.035, ram - 1);
    const coresMult = (cores + 5) / 6;
    return levelMult * ramMult * coresMult * mult;
}

function calculateHashGainRate(level: number, ramUsed: number, maxRam: number, cores: number, mult: number = 1): number {
    const HASHES_PER_LEVEL = 0.001;
    const baseGain = HASHES_PER_LEVEL * level;
    const ramMultiplier = Math.pow(1.07, Math.log2(maxRam));
    const coreMultiplier = 1 + (cores - 1) / 5;
    const ramRatio = 1 - ramUsed / maxRam;

    return baseGain * ramMultiplier * coreMultiplier * ramRatio * mult;
}

function calculateHashToMoneyExchange(ns: NS, hashes: number): number {
    const SELL_HASH_VALUE = 1_000_000;

    const cost = ns.hacknet.hashCost("Sell for Money");
    return hashes * SELL_HASH_VALUE / cost;
}

function nodeMoneyGain(ns: NS, level: number, ram: number, cores: number): number {
    const prodMult = ns.getHacknetMultipliers().production;
    if (ns.fileExists("Formulas.exe", "home")) {
        return ns.formulas.hacknetNodes.moneyGainRate(level, ram, cores, prodMult);
    } else {
        return calculateMoneyGainRate(level, ram, cores, prodMult);
    }
}

function hashGain(ns: NS, level: number, ram: number, cores: number): number {
    const prodMult = ns.getHacknetMultipliers().production;
    if (ns.fileExists("Formulas.exe", "home")) {
        return ns.formulas.hacknetServers.hashGainRate(level, 0, ram, cores, prodMult);
    } else {
        return calculateHashGainRate(level, 0, ram, cores, prodMult);
    }
}

function hashMoneyGain(ns: NS, level: number, ram: number, cores: number): number {
    const hashes = hashGain(ns, level, ram, cores);
    return calculateHashToMoneyExchange(ns, hashes);
}

function moneyGain(ns: NS, level: number, ram: number, cores: number) {
    const hashCapacity = ns.hacknet.hashCapacity();
    return hashCapacity > 0 ? hashMoneyGain(ns, level, ram, cores) : nodeMoneyGain(ns, level, ram, cores);
}

function getMoneyGainFn(ns: NS) {
    return moneyGain.bind(null, ns);
}

type UpgradeType = "node" | "level" | "ram" | "core" | null;

interface UpgradeCandidate {
    /** Index of the hacknet node, if applicable. */
    index: number | null;

    /** Type of the upgrade. */
    type: UpgradeType;

    /** Cost of the upgrade in dollars */
    cost: number;

    /** Time to the upgrade will take to pay for itself in seconds. */
    paybackTime: number;
}

function bestCandidate(best: UpgradeCandidate, candidate: UpgradeCandidate): UpgradeCandidate {
    const delta = candidate.paybackTime - best.paybackTime;

    if (Math.abs(delta) > CONFIG.paybackTimeTolerance) {
        return candidate.paybackTime < best.paybackTime ? candidate : best;
    }

    return candidate.cost < best.cost ? candidate : best;
}

function newNodeCandidate(ns: NS, baseGain: number): UpgradeCandidate {
    const cost = ns.hacknet.getPurchaseNodeCost();
    const newNodeGain = moneyGain(ns, 1, 1, 1);
    const paybackTime = cost / (baseGain + newNodeGain);
    return {
        index: null,
        type: "node",
        cost,
        paybackTime
    };
}

function upgradeLevelCandidate(ns: NS, index: number, baseGain: number): UpgradeCandidate {
    const stats = ns.hacknet.getNodeStats(index);
    const cost = ns.hacknet.getLevelUpgradeCost(index, 1);
    const currentGain = moneyGain(ns, stats.level, stats.ram, stats.cores);
    const gain = moneyGain(ns, stats.level + 1, stats.ram, stats.cores);
    const paybackTime = cost / (baseGain + gain - currentGain);
    return {
        index,
        type: "level",
        cost,
        paybackTime,
    };
}

function upgradeRamCandidate(ns: NS, index: number, baseGain: number): UpgradeCandidate {
    const stats = ns.hacknet.getNodeStats(index);
    const cost = ns.hacknet.getRamUpgradeCost(index, 1);
    const currentGain = moneyGain(ns, stats.level, stats.ram, stats.cores);
    const gain = moneyGain(ns, stats.level, stats.ram + 1, stats.cores);
    const paybackTime = cost / (baseGain + gain - currentGain);
    return {
        index,
        type: "ram",
        cost,
        paybackTime,
    };
}

function upgradeCoreCandidate(ns: NS, index: number, baseGain: number): UpgradeCandidate {
    const stats = ns.hacknet.getNodeStats(index);
    const cost = ns.hacknet.getCoreUpgradeCost(index, 1);
    const currentGain = moneyGain(ns, stats.level, stats.ram, stats.cores);
    const gain = moneyGain(ns, stats.level, stats.ram, stats.cores + 1);
    const paybackTime = cost / (baseGain + gain - currentGain);
    return {
        index,
        type: "core",
        cost,
        paybackTime,
    };
}

interface Budget {
    total: number;
    remaining: number;
}

function purchaseCandidate(ns: NS, budget: Budget, candidate: UpgradeCandidate) {
    let hacknetType = ns.hacknet.hashCapacity() > 0 ? "server" : "node";

    switch (candidate.type) {
        case "node": {
            const index = ns.hacknet.purchaseNode();
            if (index !== -1) {
                budget.remaining -= candidate.cost;
                ns.print(`SUCCESS: purchased ${upgradeDescription(ns, candidate)}`);
            } else {
                ns.print(`WARN: failed to purchase ${hacknetType}`);
                return;
            }
            break;
        }
        case "level": {
            if (ns.hacknet.upgradeLevel(candidate.index, 1)) {
                budget.remaining -= candidate.cost;
                printUpgrade(ns, candidate);
            }
            break;
        }
        case "ram": {
            if (ns.hacknet.upgradeRam(candidate.index, 1)) {
                budget.remaining -= candidate.cost;
                printUpgrade(ns, candidate);
            }
            break;
        }
        case "core": {
            if (ns.hacknet.upgradeCore(candidate.index, 1)) {
                budget.remaining -= candidate.cost;
                printUpgrade(ns, candidate);
            }
            break;
        }
    }
}

function printUpgrade(ns: NS, upgrade: UpgradeCandidate) {
    let hacknetType = ns.hacknet.hashCapacity() > 0 ? "server" : "node";
    ns.print(`SUCCESS: upgraded ${upgradeDescription(ns, upgrade)}`);
}

function upgradeDescription(ns: NS, upgrade: UpgradeCandidate): string {
    let hacknetType = ns.hacknet.hashCapacity() > 0 ? "server" : "node";
    let numNodes = ns.hacknet.numNodes();

    if (upgrade.type === "node") {
        return `hacknet-${hacknetType}-${numNodes} for $${ns.formatNumber(upgrade.cost)} payback ${ns.tFormat(upgrade.paybackTime * 1000)}`;
    }
    return `${upgrade.type} of hacknet-${hacknetType}-${upgrade.index} for $${ns.formatNumber(upgrade.cost)} payback ${ns.tFormat(upgrade.paybackTime * 1000)}`;
}
