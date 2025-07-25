import type { FactionWorkType, NS } from 'netscript';
import { MEM_TAG_FLAGS } from 'services/client/memory_tag';

export async function main(ns: NS) {
    ns.flags(MEM_TAG_FLAGS);

    await workForFactions(ns);
}

class Faction {
    name: string;
    rep: number;
    favor: number;
    favorToGain: number;
    targetRep: number;

    constructor(ns: NS, name: string, ownedAugs: Set<string>) {
        this.name = name;

        const sing = ns.singularity;
        this.rep = sing.getFactionRep(name);
        this.favor = sing.getFactionFavor(name);
        this.favorToGain = sing.getFactionFavorGain(name);

        const augs = sing
            .getAugmentationsFromFaction(name)
            .filter((aug) => !ownedAugs.has(aug));

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

    while (true) {
        const ownedAugs = getOwnedAugs(ns);

        const unfinishedFactions = getUnfinishedFactions(ns, ownedAugs);
        if (unfinishedFactions.length === 0) return;

        unfinishedFactions.sort((a, b) => a.rep - b.rep);

        const lowestRepFaction = unfinishedFactions[0];

        const workType = getBestWorkTypeForFaction(ns, lowestRepFaction.name);

        if (!sing.workForFaction(lowestRepFaction.name, workType, false)) {
            ns.print(
                `WARN: could not start working ${workType} for ${lowestRepFaction.name}`,
            );
            return;
        }

        await ns.sleep(10_000);
    }
}

function getBestWorkTypeForFaction(ns: NS, faction: string): FactionWorkType {
    const player = ns.getPlayer();
    const workTypes = ns.singularity.getFactionWorkTypes(faction).map((w) => {
        const favor = ns.singularity.getFactionFavor(faction);
        const gains = ns.formulas.work.factionGains(player, w, favor);
        return {
            type: w,
            ...gains,
        };
    });

    workTypes.sort((a, b) => b.reputation - a.reputation);

    return workTypes[0].type;
}

function getOwnedAugs(ns: NS): Set<string> {
    const reset = ns.getResetInfo();
    return new Set(reset.ownedAugs.keys());
}

function getUnfinishedFactions(ns: NS, ownedAugs: Set<string>) {
    const factions = ns
        .getPlayer()
        .factions.map((name) => new Faction(ns, name, ownedAugs));
    return factions.filter((f) => !haveNeededRepForFaction(ns, f));
}

function haveNeededRepForFaction(ns: NS, faction: Faction) {
    return (
        faction.targetRep <= faction.rep
        || faction.favor + faction.favorToGain >= ns.getFavorToDonate()
    );
}
