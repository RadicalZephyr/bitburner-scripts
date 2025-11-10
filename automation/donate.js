import { parseFlags } from 'util/flags';
const FLAGS = [['help', false]];
export function autocomplete(data) {
    data.flags(FLAGS);
    return [];
}
export async function main(ns) {
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
    donateForAugments(ns);
}
function donateForAugments(ns) {
    const player = ns.getPlayer();
    const factions = player.factions;
    for (const f of factions) {
        const favor = ns.singularity.getFactionFavor(f);
        // Skip factions we can't donate to
        if (favor < ns.getFavorToDonate())
            continue;
        const rep = ns.singularity.getFactionRep(f);
        const maxRep = getMaxRep(ns, f);
        const repDelta = maxRep - rep;
        if (repDelta <= 0)
            continue;
        const donation = donationForRep(ns, repDelta, player);
        const result = ns.singularity.donateToFaction(f, donation);
        if (!result)
            ns.print(`WARN: failed to donate to ${f}`);
    }
}
function getMaxRep(ns, f) {
    const augs = ns.singularity.getAugmentationsFromFaction(f).map((a) => {
        return { name: a, rep: ns.singularity.getAugmentationRepReq(a) };
    });
    if (augs.length === 0)
        return 0;
    augs.sort((a, b) => b.rep - a.rep);
    return augs[0].rep;
}
function donationForRep(ns, rep, player) {
    if (ns.fileExists('Formulas.exe', 'home')) {
        return ns.formulas.reputation.donationForRep(rep, player);
    }
    else {
        return estDonationForRep(rep, player);
    }
}
function estDonationForRep(rep, person) {
    const DonateMoneyToRepDivisor = 1e6;
    return (rep * DonateMoneyToRepDivisor) / person.mults.faction_rep;
}
