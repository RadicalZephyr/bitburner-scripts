import type { NS } from 'netscript';

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

    const ownedAugs: Set<string> = new Set(sing.getOwnedAugmentations(true));
    const uniqueAugs: Set<string> = new Set();
    const augs: Aug[] = [];

    for (const f of factions) {
        for (const aug of sing.getAugmentationsFromFaction(f)) {
            if (ownedAugs.has(aug) || uniqueAugs.has(aug)) continue;

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

    if (options['dry-run']) {
        ns.ui.openTail();
        return;
    }

    const augmentationSpendPercentage = options.spend;

    const purchasedAugs = [];
    let budget =
        ns.getServerMoneyAvailable('home') * augmentationSpendPercentage;

    for (const aug of augs) {
        const cost = sing.getAugmentationPrice(aug.name);

        if (cost > budget) break;

        const purchased = sing.purchaseAugmentation(aug.faction, aug.name);

        if (purchased) {
            budget -= cost;
            purchasedAugs.push({ purchasePrice: cost, ...aug });
        } else {
            ns.print(`WARN: failed to purchase ${aug.name}`);
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
