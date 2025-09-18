import type { AutocompleteData, NS } from '@ns';
import { FlagsSchema, parseFlags } from 'util/flags';

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

Start bootstrapping process on home.

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
    const hostname = BOOTSTRAP_HOST;

    if (!ns.nuke(hostname)) {
        reportError(ns, `failed to nuke ${hostname}`);
        return;
    }

    const args = flags.minimal ? ['--minimal'] : [];
    ns.spawn(
        script,
        { threads: 1, preventDuplicates: true, spawnDelay: 0 },
        hostname,
        ...args,
    );
}

function reportError(ns: NS, error: string) {
    ns.toast(error, 'error');
    ns.print(`ERROR: ${error}`);
    ns.ui.openTail();
}
