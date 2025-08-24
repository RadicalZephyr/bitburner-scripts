import type { NS, AutocompleteData } from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

import { sendTerminalCommand } from 'util/terminal';

const FLAGS = [['help', false]] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return data.servers;
}

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    if (
        flags.help
        || flags._.length !== 1
        || typeof flags._[0] !== 'string'
        || !ns.serverExists(flags._[0])
    ) {
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

async function manualTill(ns: NS, target: string) {
    await sendTerminalCommand(ns, `connect ${target}`);

    const minSec = ns.getServerMinSecurityLevel(target);
    while (minSec < ns.getServerSecurityLevel(target)) {
        await sendTerminalCommand(ns, 'weaken');
    }

    await sendTerminalCommand(ns, 'home');
}
