import type { NS, AutocompleteData, Player } from '@ns';
import { FlagsSchema, parseFlags } from 'util/flags';

import { SinceInstall, SinceStart } from 'services/client/money-sources';
import { Player as PlayerCell } from 'services/client/player-info';

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

Do awesome stuff!

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --help   Show this help message
`);
        return;
    }

    await updateCells(ns, 100, updaters(ns));
}

export function updaters(ns: NS) {
    return Transaction.execute(() => {
        return [
            new ApiCellUpdater<Player>(
                PlayerCell,
                () => ns.getPlayer(),
                isStructuralEqual,
            ),
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
