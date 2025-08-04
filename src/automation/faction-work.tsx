import type { AutocompleteData, FactionWorkType, NS } from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

import { Toggle, FocusToggle } from 'util/focus';
import {
    KARMA_HEIGHT,
    STATUS_WINDOW_HEIGHT,
    STATUS_WINDOW_WIDTH,
} from 'util/ui';

const FLAGS = [
    ['focus', false],
    ['help', false],
] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}
export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    if (flags.help || typeof flags.focus !== 'boolean') {
        ns.print(`
USAGE: run ${ns.getScriptName()}

Continuously monitor for faction invitations and accept them as long as that faction has no enemies.

OPTIONS
  --help           Show this help message
`);
        return;
    }

    ns.disableLog('ALL');
    ns.clearLog();

    ns.ui.openTail();
    ns.ui.resizeTail(STATUS_WINDOW_WIDTH, KARMA_HEIGHT);
    const [ww] = ns.ui.windowSize();
    ns.ui.moveTail(
        ww - STATUS_WINDOW_WIDTH,
        STATUS_WINDOW_HEIGHT + KARMA_HEIGHT,
    );

    const focus = new Toggle(ns, flags.focus as boolean);
    ns.printRaw(<FocusToggle ns={ns} focus={focus} />);
    ns.ui.renderTail();

    await workForFactions(ns, focus);
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

async function workForFactions(ns: NS, focus: Toggle) {
    const sing = ns.singularity;

    while (true) {
        const ownedAugs = getOwnedAugs(ns);

        const unfinishedFactions = getUnfinishedFactions(ns, ownedAugs);
        if (unfinishedFactions.length === 0) return;

        unfinishedFactions.sort((a, b) => a.rep - b.rep);

        const lowestRepFaction = unfinishedFactions[0];

        const workType = getBestWorkTypeForFaction(ns, lowestRepFaction.name);

        if (
            !sing.workForFaction(lowestRepFaction.name, workType, focus.value)
        ) {
            ns.print(
                `WARN: could not start working ${workType} for ${lowestRepFaction.name}`,
            );
            return;
        }

        await ns.asleep(10_000);
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
