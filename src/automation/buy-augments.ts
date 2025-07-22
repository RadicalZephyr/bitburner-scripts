import type { NS } from 'netscript';

import { MEM_TAG_FLAGS } from 'services/client/memory_tag';

export async function main(ns: NS) {
    ns.flags(MEM_TAG_FLAGS);

    const sing = ns.singularity;

    ns.disableLog('ALL');
    const factions = ns.getPlayer().factions;

    const uniqueAugs: Set<string> = new Set();
    const augs: Aug[] = [];

    for (const f of factions) {
        for (const aug of sing.getAugmentationsFromFaction(f)) {
            if (uniqueAugs.has(aug)) continue;

            uniqueAugs.add(aug);

            const rep = sing.getAugmentationRepReq(aug);
            const baseCost = sing.getAugmentationBasePrice(aug);

            const factionRep = sing.getFactionRep(f);
            if (factionRep < rep) continue;

            augs.push({
                name: aug,
                faction: f,
                rep,
                baseCost,
            });
        }
    }

    augs.sort((a, b) => b.baseCost - a.baseCost);

    ns.clearLog();
    ns.print(JSON.stringify(augs, null, 2));
    ns.ui.renderTail();

    const purchasedAugs = [];
    let budget = ns.getServerMoneyAvailable('home');

    for (const aug of augs) {
        const cost = sing.getAugmentationPrice(aug.name);

        if (cost > budget) break;

        const purchased = sing.purchaseAugmentation(aug.faction, aug.name);

        if (purchased) {
            budget -= cost;
            purchasedAugs.push({ purchasePrice: cost, ...aug });
        } else {
            break;
        }
    }

    ns.print(`SUCCESS: purchased ${purchasedAugs.length} augmentations:`);
    for (const purchase of purchasedAugs) {
        ns.print(
            `INFO: ${purchase.name} from ${purchase.faction} for ${purchase.purchasePrice}`,
        );
    }
}

interface Aug {
    name: string;
    faction: string;
    rep: number;
    baseCost: number;
}
