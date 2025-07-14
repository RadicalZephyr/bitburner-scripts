import type { NS } from "netscript";

const DEFAULT_RETURN_TIME = 60;
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
        ns.tprint(`Usage: run ${ns.getScriptName()} [--return-time MINUTES] [--spend 0-1] [--help]\n` +
            ` --return-time  Desired payback time window (default ${DEFAULT_RETURN_TIME} minutes)\n` +
            ` --spend        Portion of money to spend (default ${ns.formatPercent(DEFAULT_SPEND)})\n` +
            ` --help         Display this message`);
        return;
    }

    const returnTimeSeconds = flags["return-time"] * 60;
    let budget = ns.getServerMoneyAvailable("home") * flags.spend;
    ns.print(`INFO: starting with budget $${ns.formatNumber(budget)} and payback time ${ns.tFormat(returnTimeSeconds * 1000)}`);

    const prodMult = ns.getHacknetMultipliers().production;

    function moneyGain(level: number, ram: number, cores: number): number {
        if (ns.fileExists("Formulas.exe", "home")) {
            return ns.formulas.hacknetNodes.moneyGainRate(level, ram, cores, prodMult);
        } else {
            return calculateMoneyGainRate(level, ram, cores, prodMult);
        }
    }

    function hashGain(level: number, ram: number, cores: number): number {
        if (ns.fileExists("Formulas.exe", "home")) {
            return ns.formulas.hacknetServers.hashGainRate(level, 0, ram, cores, prodMult);
        } else {
            return calculateHashGainRate(level, 0, ram, cores, prodMult);
        }
    }

    const hashCapacity = ns.hacknet.hashCapacity();
    const gainFn = hashCapacity > 0 ? hashGain : moneyGain;

    while (true) {
        let bestIndex = -1;
        let bestType: "node" | "level" | "ram" | "core" | null = null;
        let bestCost = Infinity;
        let bestPayback = Infinity;

        const numNodes = ns.hacknet.numNodes();

        const newNodeCost = ns.hacknet.getPurchaseNodeCost();
        const newNodeGain = moneyGain(1, 1, 1);
        if (newNodeCost <= budget) {
            const payback = newNodeCost / newNodeGain;
            if (payback <= returnTimeSeconds && payback < bestPayback) {
                bestIndex = -1;
                bestType = "node";
                bestCost = newNodeCost;
                bestPayback = payback;
            }
        }

        for (let i = 0; i < numNodes; i++) {
            const stats = ns.hacknet.getNodeStats(i);
            const currentGain = moneyGain(stats.level, stats.ram, stats.cores);

            const levelCost = ns.hacknet.getLevelUpgradeCost(i, 1);
            if (levelCost <= budget && levelCost !== Infinity) {
                const gain = moneyGain(stats.level + 1, stats.ram, stats.cores);
                const payback = levelCost / (gain - currentGain);
                if (payback <= returnTimeSeconds && payback < bestPayback) {
                    bestIndex = i;
                    bestType = "level";
                    bestCost = levelCost;
                    bestPayback = payback;
                }
            }

            const ramCost = ns.hacknet.getRamUpgradeCost(i, 1);
            if (ramCost <= budget && ramCost !== Infinity) {
                const gain = moneyGain(stats.level, stats.ram * 2, stats.cores);
                const payback = ramCost / (gain - currentGain);
                if (payback <= returnTimeSeconds && payback < bestPayback) {
                    bestIndex = i;
                    bestType = "ram";
                    bestCost = ramCost;
                    bestPayback = payback;
                }
            }

            const coreCost = ns.hacknet.getCoreUpgradeCost(i, 1);
            if (coreCost <= budget && coreCost !== Infinity) {
                const gain = moneyGain(stats.level, stats.ram, stats.cores + 1);
                const payback = coreCost / (gain - currentGain);
                if (payback <= returnTimeSeconds && payback < bestPayback) {
                    bestIndex = i;
                    bestType = "core";
                    bestCost = coreCost;
                    bestPayback = payback;
                }
            }
        }

        if (!bestType) {
            break;
        }

        if (bestCost > budget) {
            break;
        }

        switch (bestType) {
            case "node": {
                const index = ns.hacknet.purchaseNode();
                if (index !== -1) {
                    budget -= bestCost;
                    ns.print(`SUCCESS: purchased hacknet-node-${index} for $${ns.formatNumber(bestCost)} payback ${ns.tFormat(bestPayback * 1000)}`);
                } else {
                    ns.print(`WARN: failed to purchase node`);
                    return;
                }
                break;
            }
            case "level": {
                if (ns.hacknet.upgradeLevel(bestIndex, 1)) {
                    budget -= bestCost;
                    ns.print(`SUCCESS: upgraded level of node-${bestIndex} for $${ns.formatNumber(bestCost)} payback ${ns.tFormat(bestPayback * 1000)}`);
                }
                break;
            }
            case "ram": {
                if (ns.hacknet.upgradeRam(bestIndex, 1)) {
                    budget -= bestCost;
                    ns.print(`SUCCESS: upgraded ram of node-${bestIndex} for $${ns.formatNumber(bestCost)} payback ${ns.tFormat(bestPayback * 1000)}`);
                }
                break;
            }
            case "core": {
                if (ns.hacknet.upgradeCore(bestIndex, 1)) {
                    budget -= bestCost;
                    ns.print(`SUCCESS: upgraded cores of node-${bestIndex} for $${ns.formatNumber(bestCost)} payback ${ns.tFormat(bestPayback * 1000)}`);
                }
                break;
            }
        }

        await ns.sleep(0);
    }
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
    return 0;
}
