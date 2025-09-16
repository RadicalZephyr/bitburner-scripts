import type { NS, AutocompleteData, Player } from '@ns';
import { FlagsSchema, parseFlags } from 'util/flags';

const FLAGS = [['help', false]] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    if (flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

Donate to all factions to make all augments available for sleeves to buy.

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --help   Show this help message
`);
        return;
    }

    await donateForAugments(ns);
}

async function donateForAugments(ns: NS) {
    const player = ns.getPlayer();
    const factions = player.factions;

    for (const f of factions) {
        const favor = ns.singularity.getFactionFavor(f);

        // Skip factions we can't donate to
        if (favor < ns.getFavorToDonate()) continue;

        const rep = ns.singularity.getFactionRep(f);
        const maxRep = getMaxRep(ns, f);
        const repDelta = maxRep - rep;
        if (repDelta <= 0) continue;

        const donation = donationForRep(ns, repDelta, player);
        const result = ns.singularity.donateToFaction(f, donation);
        if (!result) ns.print(`WARN: failed to donate to ${f}`);
    }
}

function getMaxRep(ns: NS, f: string): number {
    const augs = ns.singularity.getAugmentationsFromFaction(f).map((a) => {
        return { name: a, rep: ns.singularity.getAugmentationRepReq(a) };
    });

    if (augs.length === 0) return 0;

    augs.sort((a, b) => b.rep - a.rep);

    return augs[0].rep;
}

function donationForRep(ns: NS, rep: number, player: Player): number {
    if (ns.fileExists('Formulas.exe', 'home')) {
        return ns.formulas.reputation.donationForRep(rep, player);
    } else {
        return estDonationForRep(rep, player);
    }
}

function estDonationForRep(rep: number, person: Player): number {
    const DonateMoneyToRepDivisor = 1e6;
    return (rep * DonateMoneyToRepDivisor) / person.mults.faction_rep;
}
