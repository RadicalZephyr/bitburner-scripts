import type { AutocompleteData, FactionWorkType, NS } from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

import { CONFIG } from 'automation/config';

const FLAGS = [['help', false]] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}
export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    if (flags.help) {
        ns.print(`
USAGE: run ${ns.getScriptName()}

Cycle between working for every factions we are members of until we reach the
required rep to buy all augmentations only available from this faction.

OPTIONS
  --help           Show this help message
`);
        return;
    }

    await workForFactions(ns);
    ns.tprint('finished faction work');
}

class Faction {
    ns: NS;
    name: string;
    rep: number;
    favor: number;
    favorToGain: number;
    augs: string[];
    targetRep: number;

    constructor(ns: NS, name: string, ownedAugs: Set<string>) {
        this.ns = ns;
        this.name = name;

        const sing = ns.singularity;
        this.rep = sing.getFactionRep(name);
        this.favor = sing.getFactionFavor(name);
        this.favorToGain = sing.getFactionFavorGain(name);

        const augs = sing.getAugmentationsFromFaction(name);
        this.augs = augs;

        if (augs.length < 1) {
            this.targetRep = 0;
            return;
        }

        const highestRepUniqueAug = this.neededAugs(ownedAugs)[0];
        if (highestRepUniqueAug) {
            this.targetRep = sing.getAugmentationRepReq(highestRepUniqueAug);
        } else {
            this.targetRep = 0;
        }
    }

    neededAugs(ownedAugs: Set<string>) {
        return this.augs
            .filter(
                (aug) =>
                    !ownedAugs.has(aug) && uniqueAug(this.ns, this.name, aug),
            )
            .sort(
                (a, b) =>
                    this.ns.singularity.getAugmentationRepReq(b)
                    - this.ns.singularity.getAugmentationRepReq(a),
            );
    }
}

function uniqueAug(ns: NS, factionName: string, aug: string): boolean {
    const myFactions = new Set(getFactions(ns));

    const thisFaction = new Set([factionName]);
    const allFactions = new Set(ns.singularity.getAugmentationFactions(aug));
    const otherFactions = allFactions
        .difference(thisFaction)
        .intersection(myFactions);
    return otherFactions.size === 0;
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

        if (
            !sing.workForFaction(
                lowestRepFaction.name,
                workType,
                ns.singularity.isFocused(),
            )
        ) {
            ns.print(
                `WARN: could not start working ${workType} for ${lowestRepFaction.name}`,
            );
            return;
        }

        await ns.asleep(CONFIG.factionWorkTimeMs);
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
    return new Set(ns.singularity.getOwnedAugmentations(true));
}

function getFactions(ns: NS) {
    return ns.getPlayer().factions;
}

function getUnfinishedFactions(ns: NS, ownedAugs: Set<string>) {
    const factions = getFactions(ns)
        .map((name) => new Faction(ns, name, ownedAugs))
        .filter((f) => ns.singularity.getFactionWorkTypes(f.name).length > 0);
    return factions.filter((f) => !haveNeededRepForFaction(ns, f));
}

function haveNeededRepForFaction(ns: NS, faction: Faction) {
    return (
        faction.targetRep <= faction.rep
        || faction.favor + faction.favorToGain >= ns.getFavorToDonate()
    );
}
