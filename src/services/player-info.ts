import type { NS, AutocompleteData } from '@ns';
import { FlagsSchema, parseFlags } from 'util/flags';

import { Player } from 'services/client/player-info';

import { makeFuid } from 'util/fuid';
import { isStructuralEqual } from 'util/structural-equals';

import { CellSink } from 'lib/sodium';

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

Update player info Sodium ApiCell.

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --help   Show this help message
`);
        return;
    }

    await updatePlayer(ns);
}

async function updatePlayer(ns: NS) {
    const playerCellSink = new CellSink(ns.getPlayer());
    const unlisten = Player.setSource(playerCellSink.calm(isStructuralEqual));

    let running = true;
    ns.atExit(() => {
        running = false;
        unlisten();
    }, makeFuid(ns));
    while (running) {
        playerCellSink.send(ns.getPlayer());
        await ns.sleep(100);
    }
}
