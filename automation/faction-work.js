import { parseFlags } from 'util/flags';
import { CONFIG } from 'automation/config';
const FLAGS = [['help', false]];
export function autocomplete(data) {
    data.flags(FLAGS);
    return [];
}
export async function main(ns) {
    const flags = await parseFlags(ns, FLAGS);
    if (flags.help) {
        ns.print(`
USAGE: run ${ns.getScriptName()}

Cycle between working for every factions we are members of until we reach the
required rep to buy all augmentations only available from this faction.

OPTIONS
  --help           Show this help message

CONFIGURATION
  AUTO_factionWorkTimeMs  The length of time to work for one company.
`);
        return;
    }
    await workForFactions(ns);
    ns.tprint('finished faction work');
}
class Faction {
    ns;
    name;
    rep;
    favor;
    favorToGain;
    augs;
    targetRep;
    constructor(ns, name, ownedAugs) {
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
        }
        else {
            this.targetRep = 0;
        }
    }
    neededAugs(ownedAugs) {
        return this.augs
            .filter((aug) => !ownedAugs.has(aug) && uniqueAug(this.ns, this.name, aug))
            .sort((a, b) => this.ns.singularity.getAugmentationRepReq(b)
            - this.ns.singularity.getAugmentationRepReq(a));
    }
}
function uniqueAug(ns, factionName, aug) {
    const myFactions = new Set(getFactions(ns));
    const thisFaction = new Set([factionName]);
    const allFactions = new Set(ns.singularity.getAugmentationFactions(aug));
    const otherFactions = allFactions
        .difference(thisFaction)
        .intersection(myFactions);
    return otherFactions.size === 0;
}
async function workForFactions(ns) {
    const sing = ns.singularity;
    while (true) {
        const ownedAugs = getOwnedAugs(ns);
        const unfinishedFactions = getUnfinishedFactions(ns, ownedAugs);
        if (unfinishedFactions.length === 0)
            return;
        unfinishedFactions.sort((a, b) => a.rep - b.rep);
        const lowestRepFaction = unfinishedFactions[0];
        const workType = getBestWorkTypeForFaction(ns, lowestRepFaction.name);
        if (!sing.workForFaction(lowestRepFaction.name, workType, ns.singularity.isFocused())) {
            ns.print(`WARN: could not start working ${workType} for ${lowestRepFaction.name}`);
            return;
        }
        await ns.asleep(CONFIG.factionWorkTimeMs);
    }
}
function getBestWorkTypeForFaction(ns, faction) {
    const player = ns.getPlayer();
    const workTypes = ns.singularity.getFactionWorkTypes(faction).map((w) => {
        const favor = ns.singularity.getFactionFavor(faction);
        const gains = ns.formulas.work.factionGains(player, w, favor);
        return {
            type: w,
            ...gains,
        };
    });
    if (workTypes.length === 0)
        throw new Error(`No work available with ${faction}`);
    workTypes.sort((a, b) => b.reputation - a.reputation);
    return workTypes[0].type;
}
function getOwnedAugs(ns) {
    return new Set(ns.singularity.getOwnedAugmentations(true));
}
function getFactions(ns) {
    return ns.getPlayer().factions;
}
function getUnfinishedFactions(ns, ownedAugs) {
    const factions = getFactions(ns)
        .map((name) => new Faction(ns, name, ownedAugs))
        .filter((f) => ns.singularity.getFactionWorkTypes(f.name).length > 0);
    return factions.filter((f) => !haveNeededRepForFaction(ns, f));
}
function haveNeededRepForFaction(ns, faction) {
    return (faction.targetRep <= faction.rep
        || faction.favor + faction.favorToGain >= ns.getFavorToDonate());
}
