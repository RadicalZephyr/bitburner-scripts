import type { FactionName, FactionWorkType, NS } from 'netscript';
import { MEM_TAG_FLAGS } from 'services/client/memory_tag';

export async function main(ns: NS) {
    ns.flags(MEM_TAG_FLAGS);

    await workForFactions(ns);
}

class Faction {
    name: string;
    rep: number;
    favor: number;
    targetRep: number;

    constructor(ns: NS, name: string) {
        this.name = name;

        const sing = ns.singularity;
        this.rep = sing.getFactionRep(name);
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

async function workForFactions(ns: NS) {
    const sing = ns.singularity;

    let unfinishedFactions = getUnfinishedFactions(ns);

    while (unfinishedFactions.length > 0) {
        unfinishedFactions.sort((a, b) => a.targetRep - b.targetRep);

        const faction = unfinishedFactions.pop();
        const f = faction.name as FactionName;

        const targetRep = getTargetRep(ns, f);
        if (targetRep < faction.rep) continue;

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

        unfinishedFactions = getUnfinishedFactions(ns);
    }
}

function getTargetRep(ns: NS, f: FactionName) {
    const sing = ns.singularity;

    const augs = sing.getAugmentationsFromFaction(f);
    if (augs.length < 1) return 0;

    augs.sort(
        (a, b) => sing.getAugmentationRepReq(b) - sing.getAugmentationRepReq(a),
    );

    return sing.getAugmentationRepReq(augs[0]);
}

function getUnfinishedFactions(ns: NS) {
    const factions = ns
        .getPlayer()
        .factions.map((name) => new Faction(ns, name));
    return factions.filter((f) => !haveNeededRepForFaction(ns, f));
}

function haveNeededRepForFaction(ns: NS, faction: Faction) {
    const sing = ns.singularity;
    return (
        faction.targetRep <= sing.getFactionRep(faction.name)
        || faction.favor + sing.getFactionFavorGain(faction.name)
        >= ns.getFavorToDonate()
    );
}
