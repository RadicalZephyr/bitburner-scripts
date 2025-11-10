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

Print out the money/s of each crime type!

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --help   Show this help message
`);
        return;
    }
    printBestCrime(ns);
}
function printBestCrime(ns) {
    const crimes = allCrimes
        .map((c) => crimeStats(ns, c))
        .map(
    // c.time is in milliseconds, convert to seconds
    (c) => {
        const successChance = crimeSuccessChance(ns, c);
        const expectedMoneyPerSec = (c.money * successChance) / (c.time / 1000);
        return `${c.name}: $${ns.formatNumber(expectedMoneyPerSec)}`;
    });
    ns.tprint(`Crime money/s:\n${crimes.join('\n')}`);
}
const allCrimes = [
    'Shoplift',
    'Rob Store',
    'Mug',
    'Larceny',
    'Deal Drugs',
    'Bond Forgery',
    'Traffick Arms',
    'Homicide',
    'Grand Theft Auto',
    'Kidnap',
    'Assassination',
    'Heist',
];
function crimeStats(ns, name) {
    return { name, ...ns.singularity.getCrimeStats(name) };
}
function crimeSuccessChance(ns, crime) {
    if (ns.fileExists('Formulas.exe', 'home')) {
        return ns.formulas.work.crimeSuccessChance(ns.getPlayer(), crime.name);
    }
    else {
        return estimateCrimeSuccessChance(ns.getPlayer(), crime);
    }
}
const CONSTANTS = {
    IntelligenceCrimeWeight: 0.025,
    MaxSkillLevel: 975,
};
function estimateCrimeSuccessChance(p, crime) {
    {
        let chance = crime.hacking_success_weight * p.skills.hacking
            + crime.strength_success_weight * p.skills.strength
            + crime.defense_success_weight * p.skills.defense
            + crime.dexterity_success_weight * p.skills.dexterity
            + crime.agility_success_weight * p.skills.agility
            + crime.charisma_success_weight * p.skills.charisma
            + CONSTANTS.IntelligenceCrimeWeight * p.skills.intelligence;
        chance /= CONSTANTS.MaxSkillLevel;
        chance /= crime.difficulty;
        chance *= p.mults.crime_success;
        // chance *= currentNodeMults.CrimeSuccessRate;
        // chance *= calculateIntelligenceBonus(p.skills.intelligence, 1);
        return Math.min(chance, 1);
    }
}
