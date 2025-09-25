import type { NS, AutocompleteData } from '@ns';
import { FlagsSchema, parseFlags } from 'util/flags';

import { withPlugins } from 'ns/extend';
import { alivePlugin } from 'ns/plugins/alive';

const FLAGS = [['help', false]] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

function extendNs(ns: NS) {
    return withPlugins(ns, alivePlugin());
}

type NSX = ReturnType<typeof extendNs>;

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    if (flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

Grind intelligence by traveling constantly.

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --help   Show this help message
`);
        return;
    }

    await travelTheWorld(extendNs(ns));
}

async function travelTheWorld(ns: NSX) {
    const cn = ns.enums.CityName;
    const cityLoop = [
        cn.Aevum,
        cn.Sector12,
        cn.Volhaven,
        cn.Chongqing,
        cn.NewTokyo,
        cn.Ishima,
    ];

    while (ns.alive.isAlive()) {
        for (const city of cityLoop) {
            ns.singularity.travelToCity(city);
            await ns.asleep(10);
        }
    }
}
