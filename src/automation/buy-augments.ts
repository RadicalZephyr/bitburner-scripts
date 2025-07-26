import type { NS } from 'netscript';

import { ALLOC_ID, MEM_TAG_FLAGS } from 'services/client/memory_tag';
import { parseAndRegisterAlloc } from 'services/client/memory';

const DEFAULT_SPEND = 1.0;

export async function main(ns: NS) {
    const options = ns.flags([
        ['spend', DEFAULT_SPEND],
        ['neuroflux', false],
        ['dry-run', false],
        ['help', false],
        ...MEM_TAG_FLAGS,
    ]);

    if (
        options.help
        || typeof options.spend != 'number'
        || typeof options['dry-run'] != 'boolean'
    ) {
        ns.tprint(`
Usage: ${ns.getScriptName()} [OPTIONS]

Purchase augmentations you have enough rep for from all your factions,
in order from most expensive to least.

OPTIONS
  --dry-run    Print out the augmentations you could buy, but don't actually buy anything
  --spend      Percentage of money to spend on augmentations (default ${ns.formatPercent(DEFAULT_SPEND)})
  --neuroflux  Buy Neuroflux Governor levels after buying all other augments
  --help       Show this help message
`);
        return;
    }

    const allocationId = await parseAndRegisterAlloc(ns, options);
    if (options[ALLOC_ID] !== -1 && allocationId === null) {
        return;
    }

    const sing = ns.singularity;

    ns.disableLog('ALL');
    const player = ns.getPlayer();
    const factions = player.factions;

    const augs = await getUnpurchasedAugmentations(ns, factions);

    const augList = Array.from(augs.values());
    augList.sort((a, b) => b.baseCost - a.baseCost);

    ns.clearLog();
    ns.print(JSON.stringify(augList, null, 2));
    ns.ui.renderTail();

    if (options['dry-run']) {
        ns.ui.openTail();
        return;
    }

    const augmentationSpendPercentage = options.spend;

    let budget =
        ns.getServerMoneyAvailable('home') * augmentationSpendPercentage;

    const ownedAugs: Set<string> = new Set(sing.getOwnedAugmentations(true));
    for (const aug of augList) {
        const cost = sing.getAugmentationPrice(aug.name);

        if (cost > budget) break;

        const purchased = purchaseAugmentation(ns, ownedAugs, augs, aug);

        if (purchased) {
            budget -= cost;
            ns.print(`INFO: ${aug.name} from ${aug.faction} for ${cost}`);
        } else {
            ns.print(`WARN: failed to purchase ${aug.name}`);
        }
        await ns.asleep(10);
    }

    if (!options.neuroflux) return;

    await buyNeuroFluxGovernor(ns, budget);
}

class Aug {
    name: string;
    faction: string;
    rep: number;
    baseCost: number;

    constructor(ns: NS, augName: string, faction: string) {
        this.name = augName;
        this.faction = faction;
        const sing = ns.singularity;
        this.rep = sing.getAugmentationRepReq(augName);
        this.baseCost = sing.getAugmentationBasePrice(augName);
    }
}

async function getUnpurchasedAugmentations(
    ns: NS,
    factions: string[],
): Promise<Map<string, Aug>> {
    const sing = ns.singularity;

    const ownedAugs: Set<string> = new Set(sing.getOwnedAugmentations(true));
    const augs: Map<string, Aug> = new Map();

    for (const f of factions) {
        for (const augName of sing.getAugmentationsFromFaction(f)) {
            if (ownedAugs.has(augName) || augs.has(augName)) continue;

            const aug = new Aug(ns, augName, f);

            const factionRep = sing.getFactionRep(f);
            const factionFavor = sing.getFactionFavor(f);
            const favorToDonate = ns.getFavorToDonate();

            if (factionFavor < favorToDonate && factionRep < aug.rep) continue;

            augs.set(augName, aug);
        }
        await ns.sleep(10);
    }
    return augs;
}

function purchaseAugmentation(
    ns: NS,
    ownedAugs: Set<string>,
    augMap: Map<string, Aug>,
    aug: Aug,
): boolean {
    const sing = ns.singularity;

    const preReqs = sing.getAugmentationPrereq(aug.name);

    for (const pre of preReqs) {
        if (ownedAugs.has(pre)) continue;

        const preReqAug = augMap.get(pre);
        if (!preReqAug) return false;

        const result = purchaseAugmentation(ns, ownedAugs, augMap, preReqAug);

        if (!result) return false;
    }

    const factionRep = sing.getFactionRep(aug.faction);
    if (factionRep < aug.rep && !buyReputation(ns, aug)) return false;

    const res = sing.purchaseAugmentation(aug.faction, aug.name);
    if (res) {
        ownedAugs.add(aug.name);
        return true;
    }
    return false;
}

function buyReputation(ns: NS, aug: Aug): boolean {
    const sing = ns.singularity;

    const factionFavor = sing.getFactionFavor(aug.faction);
    const favorToDonate = ns.getFavorToDonate();
    if (factionFavor < favorToDonate) return false;

    const factionRep = sing.getFactionRep(aug.faction);
    const repDelta = aug.rep - factionRep;

    const player = ns.getPlayer();
    const donation = ns.formulas.reputation.donationForRep(repDelta, player);
    return ns.singularity.donateToFaction(aug.faction, donation);
}

async function buyNeuroFluxGovernor(ns: NS, budget: number) {
    const sing = ns.singularity;

    const nfgName = 'NeuroFlux Governor';

    const bestFaction = getBestFaction(ns);
    if (!bestFaction) {
        ns.print('WARN: no factions to buy NeuroFlux Governor from.');
        return;
    }

    let cost = augCost(ns, nfgName);

    while (cost <= budget) {
        const factionRep = ns.singularity.getFactionRep(bestFaction);
        const neuro = new Aug(ns, nfgName, bestFaction);

        if (factionRep < neuro.rep && !buyReputation(ns, neuro)) return;

        const res = sing.purchaseAugmentation(neuro.faction, neuro.name);
        if (!res) return;

        budget -= cost;
        await ns.sleep(10);

        cost = augCost(ns, nfgName);
    }
}

function augCost(ns: NS, augName: string): number {
    return ns.singularity.getAugmentationPrice(augName);
}

function getBestFaction(ns: NS): string | null {
    const factions = ns.getPlayer().factions.map((f) => {
        return {
            name: f,
            rep: ns.singularity.getFactionRep(f),
            favor: ns.singularity.getFactionFavor(f),
        };
    });
    const favorFactions = factions
        .filter((f) => f.favor >= ns.getFavorToDonate())
        .sort((a, b) => b.rep - a.rep);
    if (favorFactions.length >= 1) return favorFactions[0].name;

    factions.sort((a, b) => b.rep - a.rep);
    if (factions.length >= 1) return factions[0].name;

    return null;
}
