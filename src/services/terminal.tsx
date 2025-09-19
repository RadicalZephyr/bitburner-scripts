import type { NS, AutocompleteData } from '@ns';
import { FlagsSchema, parseFlags } from 'util/flags';

import { LaunchClient } from 'services/client/launch';
import { MemoryClient } from 'services/client/memory';

import { TerminalApp } from 'services/terminal/app';
import { createScriptResolver } from 'services/terminal/resolver';

import { exitOnKill } from 'util/exitOnKill';
import { HUD_WIDTH, STATUS_WINDOW_WIDTH } from 'util/ui';

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
    ns.disableLog('ALL');
    ns.clearLog();
    ns.ui.openTail();

    ns.ui.setTailTitle('Terminal');
    const height = 500;
    ns.ui.resizeTail(850, height);

    const [ww, wh] = ns.ui.windowSize();
    const xPos = Math.max(0, ww - (HUD_WIDTH + STATUS_WINDOW_WIDTH));
    ns.ui.moveTail(xPos, wh - (height + 60));

    const launcher = new LaunchClient(ns);
    const resolveScript = createScriptResolver(ns);
    const memoryClient = new MemoryClient(ns);

    ns.printRaw(
        <TerminalApp
            ns={ns}
            launcher={launcher}
            resolveScript={resolveScript}
            memoryClient={memoryClient}
        />,
    );

    await exitOnKill(ns);
}
