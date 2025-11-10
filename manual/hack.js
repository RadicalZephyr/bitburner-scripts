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
USAGE: run ${ns.getScriptName()}

Run manual hacking on a target.

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --help   Show this help message
`);
        return;
    }
    await hackManual(ns, flags._[0]);
}
// This can't be named manualHack because the static RAM checker will
// count that against us!
async function hackManual(ns, target) {
    await connectTo(ns, target);
    let i = 0;
    while (true) {
        await sendTerminalCommand(ns, 'hack');
        if (i % 4 === 0)
            await sendTerminalCommand(ns, 'grow');
        i += 1;
    }
}
