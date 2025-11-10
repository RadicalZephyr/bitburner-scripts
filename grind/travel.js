import { parseFlags } from 'util/flags';
import { withPlugins } from 'ns/extend';
import { alivePlugin } from 'ns/plugins/alive';
const FLAGS = [['help', false]];
export function autocomplete(data) {
    data.flags(FLAGS);
    return [];
}
function extendNs(ns) {
    return withPlugins(ns, alivePlugin());
}
export async function main(ns) {
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
async function travelTheWorld(ns) {
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
