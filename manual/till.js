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

Manually till a target server using terminal commands.

Example:
  > run ${ns.getScriptName()} foodnstuff

OPTIONS
  --help   Show this help message
`);
        return;
    }
    const target = flags._[0];
    await manualTill(ns, target);
}
async function manualTill(ns, target) {
    await connectTo(ns, target);
    const minSec = ns.getServerMinSecurityLevel(target);
    while (minSec < ns.getServerSecurityLevel(target)) {
        await sendTerminalCommand(ns, 'weaken');
    }
    await sendTerminalCommand(ns, 'home');
}
