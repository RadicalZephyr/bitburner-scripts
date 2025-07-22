import type { NS } from 'netscript';

import { MEM_TAG_FLAGS } from 'services/client/memory_tag';

export async function main(ns: NS) {
    ns.flags(MEM_TAG_FLAGS);

    const sing = ns.singularity;

    ns.disableLog('ALL');

    while (true) {
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

        await ns.sleep(1000);
    }
}

interface Aug {
    name: string;
    faction: string;
    rep: number;
    baseCost: number;
}
