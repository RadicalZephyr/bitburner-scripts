import type { NS, AutocompleteData } from '@ns';
import { FlagsSchema, parseFlags } from 'util/flags';

import { LaunchClient } from 'services/client/launch';
import { TerminalApp } from 'services/terminal/app';
import { createScriptResolver } from 'services/terminal/resolver';

import { exitOnKill } from 'util/exitOnKill';

import { React } from 'lib/react';

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

Run a custom terminal using the launch client.

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --help   Show this help message
`);
        return;
    }

    await startTerminal(ns);
}

async function startTerminal(ns: NS) {
    ns.disableLog('sleep');
    ns.disableLog('asleep');
    ns.clearLog();
    ns.ui.openTail();

    const launcher = new LaunchClient(ns);
    const resolveScript = createScriptResolver(ns);

    ns.printRaw(
        <TerminalApp
            ns={ns}
            launcher={launcher}
            resolveScript={resolveScript}
        />,
    );

    await exitOnKill(ns);
}
