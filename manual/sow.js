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

Manually sow a target server using terminal commands.

Example:
  > run ${ns.getScriptName()} foodnstuff

OPTIONS
  --help   Show this help message
`);
        return;
    }
    const target = flags._[0];
    await manualSow(ns, target);
}
async function manualSow(ns, target) {
    await connectTo(ns, target);
    const maxMoney = ns.getServerMaxMoney(target);
    while (maxMoney > ns.getServerMoneyAvailable(target)) {
        await sendTerminalCommand(ns, 'grow ; weaken ; weaken ; weaken');
    }
    await sendTerminalCommand(ns, 'home');
}
