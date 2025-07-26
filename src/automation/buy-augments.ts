import type { NS, Singularity } from 'netscript';

import { ALLOC_ID, MEM_TAG_FLAGS } from 'services/client/memory_tag';
import { parseAndRegisterAlloc } from 'services/client/memory';

const DEFAULT_SPEND = 1.0;

export async function main(ns: NS) {
    const options = ns.flags([
        ['spend', DEFAULT_SPEND],
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
  --dry-run  Print out the augmentations you could buy, but don't actually buy anything
  --spend    Percentage of money to spend on augmentations (default ${ns.formatPercent(DEFAULT_SPEND)})
  --help     Show this help message
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

    const purchasedAugs = [];
    let budget =
        ns.getServerMoneyAvailable('home') * augmentationSpendPercentage;

    for (const aug of augList) {
        const cost = sing.getAugmentationPrice(aug.name);

        if (cost > budget) break;

        const purchased = purchaseAugmentation(sing, augs, aug);

        if (purchased) {
            budget -= cost;
            ns.print(`INFO: ${aug.name} from ${aug.faction} for ${cost}`);
            purchasedAugs.push({ purchasePrice: cost, ...aug });
        } else {
            ns.print(`WARN: failed to purchase ${aug.name}`);
        }
        await ns.asleep(10);
    }
}

interface Aug {
    name: string;
    faction: string;
    rep: number;
    baseCost: number;
}

async function getUnpurchasedAugmentations(
    ns: NS,
    factions: string[],
): Promise<Map<string, Aug>> {
    const sing = ns.singularity;

    const ownedAugs: Set<string> = new Set(sing.getOwnedAugmentations(true));
    const augs: Map<string, Aug> = new Map();

    for (const f of factions) {
        for (const aug of sing.getAugmentationsFromFaction(f)) {
            if (ownedAugs.has(aug) || augs.has(aug)) continue;

            const rep = sing.getAugmentationRepReq(aug);
            const baseCost = sing.getAugmentationBasePrice(aug);

            const factionRep = sing.getFactionRep(f);
            if (factionRep < rep) continue;

            augs.set(aug, {
                name: aug,
                faction: f,
                rep,
                baseCost,
            });
        }
        await ns.sleep(10);
    }
    return augs;
}

function purchaseAugmentation(
    sing: Singularity,
    augMap: Map<string, Aug>,
    aug: Aug,
): boolean {
    const preReqs = sing.getAugmentationPrereq(aug.name);

    for (const pre of preReqs) {
        const preReqAug = augMap.get(pre);
        if (!preReqAug) return false;

        const result = purchaseAugmentation(sing, augMap, preReqAug);
        if (!result) return false;
    }

    sing.purchaseAugmentation(aug.faction, aug.name);

    return true;
}
