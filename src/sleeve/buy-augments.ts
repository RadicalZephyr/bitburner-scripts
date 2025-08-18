import type { NS, AutocompleteData } from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';
import { canAfford } from '/util/money';

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

Buy augments for sleeves.

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --help   Show this help message
`);
        return;
    }

    await watchForAugments(ns);
}

async function watchForAugments(ns: NS) {
    while (true) {
        const numSleeves = ns.sleeve.getNumSleeves();
        for (let i = 0; i < numSleeves; i++) {
            buyAugs(ns, i);
        }
        await ns.asleep(1000);
    }
}

function buyAugs(ns: NS, sleeve: number) {
    const augs = ns.sleeve.getSleevePurchasableAugs(sleeve);

    for (const aug of augs) {
        if (canAfford(ns, aug.cost)) {
            const res = ns.sleeve.purchaseSleeveAug(sleeve, aug.name);
            if (!res) {
                ns.print(
                    `WARN: tried to buy sleeve ${sleeve} '${aug.name}' but failed.`,
                );
            }
        }
    }
}
