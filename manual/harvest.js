import { parseFlags } from 'util/flags';
import { connectTo } from 'util/connect';
import { sendTerminalCommand } from 'util/terminal';
const FLAGS = [['help', false]];
export function autocomplete(data) {
    data.flags(FLAGS);
    return data.servers;
}
export async function main(ns) {
    const flags = await parseFlags(ns, FLAGS);
    if (flags.help
        || flags._.length !== 1
        || typeof flags._[0] !== 'string'
        || !ns.serverExists(flags._[0])) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()} TARGET

Manually hack a server through terminal automation.

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --help   Show this help message
`);
        return;
    }
    const target = flags._[0];
    await manualHarvest(ns, target);
}
async function manualHarvest(ns, target) {
    await connectTo(ns, target);
    while (true) {
        await sendTerminalCommand(ns, 'hack ; weaken ; grow ; weaken ; weaken ; weaken');
    }
}
