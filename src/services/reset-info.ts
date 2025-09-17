import type { NS, AutocompleteData } from '@ns';
import { FlagsSchema, parseFlags } from 'util/flags';

import { OwnedAugs, SourceFiles } from 'services/client/reset-info';

import { ApiCellUpdater, updateCells } from 'util/sodium-api';

import { Map, is } from 'lib/immutable';
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

Update Reset Info related Sodium ApiCells.

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
    return Transaction.run(() => {
        return [
            new ApiCellUpdater(
                OwnedAugs,
                () => Map(ns.getResetInfo().ownedAugs),
                is,
            ),
            new ApiCellUpdater(
                SourceFiles,
                () => Map(ns.getResetInfo().ownedSF),
                is,
            ),
        ];
    });
}
