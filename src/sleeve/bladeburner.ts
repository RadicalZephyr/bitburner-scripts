import type { NS, AutocompleteData } from 'netscript';
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

Set sleeves to working on Bladeburner.

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --help   Show this help message
`);
        return;
    }

    doBladeburnerStuff(ns);
}

function doBladeburnerStuff(ns: NS) {
    const numSleeves = ns.sleeve.getNumSleeves();
    let i = 0;
    for (; i < Math.floor(numSleeves / 2); i++) {
        if (!ns.sleeve.setToBladeburnerAction(i, 'Field Analysis'))
            throw new Error(
                `failed to start sleeve ${i} doing Bladeburner Field Analysis`,
            );
    }

    for (; i < numSleeves; i++) {
        if (!ns.sleeve.setToBladeburnerAction(i, 'Training'))
            throw new Error(
                `failed to start sleeve ${i} doing Bladeburner Training`,
            );
    }
}
