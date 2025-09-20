import type { AutocompleteData, NS } from '@ns';
import { FlagsSchema, parseFlags } from 'util/flags';

import { main as serviceBootstrap } from 'services/bootstrap';
import { main as batchBootstrap } from 'batch/bootstrap';
import { main as automationBootstrap } from 'automation/bootstrap';
import { main as goBootstrap } from 'go/bootstrap';
import { main as bladeburnerBootstrap } from 'bladeburner/bootstrap';

import { getSourceFileLevel } from 'services/client/reset-info';

// NOTE: When adding flags to this bootstrap script the same flags
// must also be specified to all `**/bootstrap` scripts called by this
// script because they will see the same command line arguments and
// try to process the same flags.
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

Run bootstrap scripts to start various systems.

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --minimal  Start minimal services appropriate to early bitnode conditions
  --help   Show this help message
`);
        return;
    }

    await serviceBootstrap(ns);
    await goBootstrap(ns);

    if (flags.minimal) return;

    await batchBootstrap(ns);

    const sf4 = getSourceFileLevel(4);
    if (sf4 > 0) {
        await automationBootstrap(ns);
    }

    const sf7 = getSourceFileLevel(7);
    if (sf7 > 0) {
        await bladeburnerBootstrap(ns);
    }
}

interface DynImportNS extends NS {
    dynamicImport: (script: string) => Promise<ImportedScript>;
}

interface ImportedScript {
    main: (ns: NS) => Promise<void>;
}

const BOOTSTRAP_SCRIPTS = ['/services/bootstrap.js', '/batch/bootstrap.js'];

export async function dynamicBootstrap(_ns: NS) {
    const ns = _ns as DynImportNS;

    let currentDynamicRam = ns.ramOverride();

    for (const script of BOOTSTRAP_SCRIPTS) {
        const scriptRam = ns.getScriptRam(script);

        currentDynamicRam = ns.ramOverride(
            Math.max(currentDynamicRam, scriptRam),
        );

        const mod = await ns.dynamicImport(script);
        await mod.main(ns);

        await ns.sleep(10);
    }
}
