import type { NS, AutocompleteData, CrimeType, CrimeStats } from 'netscript';
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

Print out the money/s of each crime type!

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --help   Show this help message
`);
        return;
    }

    await printBestCrime(ns);
}

async function printBestCrime(ns: NS) {
    const crimes = Object.keys(ns.enums.CrimeType)
        .map((c) => crimeStats(ns, ns.enums.CrimeType[c]))
        .map(
            // c.time is in milliseconds, convert to seconds
            (c) => `${c.name}: $${ns.formatNumber(c.money / (c.time / 1000))}`,
        );

    ns.tprint(`Crime money/s:\n${crimes.join('\n')}`);
}

interface Crime extends CrimeStats {
    name: CrimeType;
}

function crimeStats(ns: NS, name: CrimeType): Crime {
    return { name, ...ns.singularity.getCrimeStats(name) };
}
