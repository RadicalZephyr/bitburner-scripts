import type { FactionWorkType, NS, Singularity } from 'netscript';
import { MEM_TAG_FLAGS } from 'services/client/memory_tag';

export async function main(ns: NS) {
    ns.flags(MEM_TAG_FLAGS);

    const sing = ns.singularity;

    await workForFactions(ns, sing);
}

class Faction {
    name: string;
    favor: number;
    targetRep: number;

    constructor(ns: NS, name: string) {
        this.name = name;

        const sing = ns.singularity;

        this.favor = sing.getFactionFavor(name);
        const augs = sing.getAugmentationsFromFaction(name);

        if (augs.length < 1) {
            this.targetRep = 0;
            return;
        }

        augs.sort(
            (a, b) =>
                sing.getAugmentationRepReq(b) - sing.getAugmentationRepReq(a),
        );

        this.targetRep = sing.getAugmentationRepReq(augs[0]);
    }
}

async function workForFactions(ns: NS, sing: Singularity) {
    const factions = ns
        .getPlayer()
        .factions.map((name) => new Faction(ns, name));
    let unfinishedFactions = factions.filter(
        (f) => !haveNeededRepForFaction(ns, f),
    );

    while (unfinishedFactions.length > 0) {
        unfinishedFactions.sort((a, b) => a.targetRep - b.targetRep);

        const faction = unfinishedFactions.pop();
        const f = faction.name;

        const augs = sing.getAugmentationsFromFaction(f);
        if (augs.length < 1) continue;

        augs.sort(
            (a, b) =>
                sing.getAugmentationRepReq(b) - sing.getAugmentationRepReq(a),
        );

        const targetRep = sing.getAugmentationRepReq(augs[0]);

        const workTypes = sing.getFactionWorkTypes(f);
        if (workTypes.length < 1) continue;

        const player = ns.getPlayer();
        const favor = sing.getFactionFavor(f);
        if (favor > ns.getFavorToDonate()) continue;

        function factionGains(w: FactionWorkType) {
            return ns.formulas.work.factionGains(player, w, favor);
        }

        function compareWorkGains(a: FactionWorkType, b: FactionWorkType) {
            return factionGains(b).reputation - factionGains(a).reputation;
        }

        workTypes.sort(compareWorkGains);

        sing.workForFaction(f, workTypes[0]);

        while (
            targetRep > sing.getFactionRep(f)
            && favor + sing.getFactionFavorGain(f) < ns.getFavorToDonate()
        ) {
            await ns.sleep(1000);
        }

        const factions = ns
            .getPlayer()
            .factions.map((name) => new Faction(ns, name));
        unfinishedFactions = factions.filter(
            (f) => !haveNeededRepForFaction(ns, f),
        );
    }
}

function haveNeededRepForFaction(ns: NS, faction: Faction) {
    const sing = ns.singularity;
    return (
        faction.targetRep <= sing.getFactionRep(faction.name)
        || faction.favor + sing.getFactionFavorGain(faction.name)
        >= ns.getFavorToDonate()
    );
}
