import { parseFlags } from 'util/flags';
const FLAGS = [
    ['crime', 'Shoplift'],
    ['help', false],
];
export function autocomplete(data, args) {
    data.flags(FLAGS);
    const secondLast = args.at(-2);
    const last = args.at(-1);
    const crimeFlag = '--crime';
    const crimes = crimeTypes(data.enums).map((g) => `'${g}'`);
    if (last === crimeFlag)
        return crimes;
    if (secondLast === crimeFlag)
        return crimes.filter((c) => c.startsWith(last));
    return [];
}
export async function main(ns) {
    const flags = await parseFlags(ns, FLAGS);
    if (flags.help || !isCrime(ns, flags.crime)) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

Start a crime ring with all your sleeves!

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --crime  Which type of crime to start
  --help   Show this help message
`);
        return;
    }
    startCrimeRing(ns, flags.crime);
}
function startCrimeRing(ns, crime) {
    const numSleeves = ns.sleeve.getNumSleeves();
    for (let i = 0; i < numSleeves; i++) {
        if (!ns.sleeve.setToCommitCrime(i, crime))
            throw new Error(`failed to set sleeve ${i} to ${crime}`);
    }
}
function isCrime(ns, crime) {
    const crimes = new Set(crimeTypes(ns.enums));
    return crimes.has(crime);
}
function crimeTypes(enums) {
    return [
        enums.CrimeType.shoplift,
        enums.CrimeType.robStore,
        enums.CrimeType.mug,
        enums.CrimeType.larceny,
        enums.CrimeType.dealDrugs,
        enums.CrimeType.bondForgery,
        enums.CrimeType.traffickArms,
        enums.CrimeType.homicide,
        enums.CrimeType.grandTheftAuto,
        enums.CrimeType.kidnap,
        enums.CrimeType.assassination,
        enums.CrimeType.heist,
    ];
}
