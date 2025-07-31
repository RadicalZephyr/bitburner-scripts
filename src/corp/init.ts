import type { AutocompleteData, NS } from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

import { AGRI_DIVISION, CITIES, CORPORATION_NAME } from 'corp/constants';

const FLAGS = [
    ['self', false],
    ['help', false],
] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    if (
        (typeof flags.help !== 'boolean' && flags.help)
        || typeof flags.self !== 'boolean'
    ) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

Create our corporation and initial agriculture division.

OPTIONS
  --help Display this help message
  --self Self fund starting your corporation (need +$150 billion)

Example:
  > run ${ns.getScriptName()}
`);
        return;
    }

    const selfFund = flags.self;

    const corp = ns.corporation;
    if (!corp.hasCorporation()) {
        if (!corp.canCreateCorporation(selfFund)) {
            ns.tprint('not in a corporation!');
            return;
        }

        if (!corp.createCorporation(CORPORATION_NAME, selfFund)) {
            ns.tprint(
                'could not create corporation, you may need to self-fund it!',
            );
            return;
        }
    }

    const c = corp.getCorporation();

    if (-1 === c.divisions.findIndex((d) => d === AGRI_DIVISION)) {
        corp.expandIndustry('Agriculture', AGRI_DIVISION);
    }

    for (const city of CITIES) {
        corp.expandCity(AGRI_DIVISION, city);
        corp.getWarehouse(AGRI_DIVISION, city);
        corp.upgradeOfficeSize(AGRI_DIVISION, city, 4);
    }
}
