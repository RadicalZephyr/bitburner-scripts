import type { NS, AutocompleteData } from '@ns';
import { FlagsSchema, parseFlags } from 'util/flags';

import { SinceInstall, SinceStart } from 'services/client/money-sources';

import { ApiCellUpdater, updateCells } from 'util/sodium-api';
import { isStructuralEqual } from 'util/structural-equals';

import { Transaction } from 'lib/sodium';

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

Update the money sources Cell.

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --help   Show this help message
`);
        return;
    }

    await updateCells(ns, 100, updaters(ns));
}

function updaters(ns: NS) {
    return Transaction.execute(() => {
        return [
            new ApiCellUpdater(
                SinceInstall,
                () => ns.getMoneySources().sinceInstall,
                isStructuralEqual,
            ),
            new ApiCellUpdater(
                SinceStart,
                () => ns.getMoneySources().sinceStart,
                isStructuralEqual,
            ),
        ];
    });
}
