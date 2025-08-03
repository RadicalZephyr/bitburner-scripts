import type { AutocompleteData, NS } from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

import { collectDependencies } from 'util/dependencies';

const BOOTSTRAP_HOST = 'foodnstuff';

const FLAGS = [
    ['minimal', false],
    ['help', false],
] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    if (flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

Start bootstrapping process on ${BOOTSTRAP_HOST}.

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --minimal  Start minimal services appropriate to early bitnode conditions
  --help     Show this help message
`);
        return;
    }

    ns.disableLog('sleep');

    const script = '/bootstrap.js';
    const dependencies = collectDependencies(ns, script);
    const files = [script, ...dependencies];
    const hostname = BOOTSTRAP_HOST;

    if (!ns.scp(files, hostname, 'home')) {
        reportError(ns, `failed to send files to ${hostname}`);
        return;
    }

    if (!ns.nuke(hostname)) {
        reportError(ns, `failed to nuke ${hostname}`);
        return;
    }

    const args = flags.minimal ? ['--minimal'] : [];
    const pid = ns.exec(script, hostname, 1, ...args);
    if (pid === 0) {
        reportError(ns, `failed to launch ${script} on ${hostname}`);
        return;
    }
}

function reportError(ns: NS, error: string) {
    ns.toast(error, 'error');
    ns.print(`ERROR: ${error}`);
    ns.ui.openTail();
}
