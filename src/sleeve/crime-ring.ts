import type { NS, AutocompleteData, CrimeType, NSEnums } from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

const FLAGS = [
    ['crime', 'Shoplift'],
    ['help', false],
] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData, args: string[]): string[] {
    data.flags(FLAGS);

    const secondLast = args.at(-2);
    const last = args.at(-1);

    const crimeFlag = '--crime';
    const crimes = crimeTypes(data.enums).map((g) => `'${g}'`);

    if (last === crimeFlag) return crimes;

    if (secondLast === crimeFlag)
        return crimes.filter((c) => c.startsWith(last));

    return [];
}

export async function main(ns: NS) {
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

function startCrimeRing(ns: NS, crime: CrimeType | `${CrimeType}`) {
    const numSleeves = ns.sleeve.getNumSleeves();
    for (let i = 0; i < numSleeves; i++) {
        if (!ns.sleeve.setToCommitCrime(i, crime))
            throw new Error(`failed to set sleeve ${i} to ${crime}`);
    }
}

function isCrime(ns: NS, crime: string): crime is CrimeType {
    const crimes = new Set(crimeTypes(ns.enums)) as Set<string>;
    return crimes.has(crime);
}

function crimeTypes(enums: NSEnums): CrimeType[] {
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
