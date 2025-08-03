import type { AutocompleteData, NS } from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

import { main as serviceBootstrap } from 'services/bootstrap';
import { main as batchBootstrap } from 'batch/bootstrap';
import { main as automationBootstrap } from 'automation/bootstrap';
import { main as goBootstrap } from 'go/bootstrap';

import { getSourceFileLevel } from 'services/client/source_file';

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

    const sf4 = await getSourceFileLevel(ns, 4);
    if (sf4 > 0) {
        await automationBootstrap(ns);
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

        const mod = (await ns.dynamicImport(script)) as ImportedScript;
        await mod.main(ns);

        await ns.sleep(10);
    }
}
