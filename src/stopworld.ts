import type { NS, AutocompleteData } from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

import { killEverywhere } from 'util/kill';

const FLAGS = [['help', false]] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return data.scripts;
}

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    if (flags.help) {
        ns.tprint(`
This script kills all running scripts across all running hosts.

USAGE: run ${ns.getScriptName()} [TARGET_SCRIPT...]

OPTIONS:
  TARGET_SCRIPT  script name(s) to kill
  --help         Show this help message

Example:
  > run ${ns.getScriptName()} hack.js
`);
        return;
    }

    const targetScripts = flags._ as string[];

    await killEverywhere(ns, ...targetScripts);

    const message = 'SUCCESS: finished stopping scripts';
    ns.toast(message);
    ns.tprint(message);
}
