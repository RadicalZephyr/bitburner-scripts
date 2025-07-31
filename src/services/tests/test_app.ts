import type { AutocompleteData, NS } from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

import { ALLOC_ID_ARG } from 'services/client/memory_tag';

const FLAGS = [['help', false]] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    const rest = flags._;
    if (flags.help || rest.length === 0 || typeof rest[0] !== 'number') {
        ns.tprint(
            `Usage: run ${ns.getScriptName()} ${ALLOC_ID_ARG} ID TIME_MS`,
        );
        return;
    }

    const sleepTime = rest[0] as number;
    await ns.sleep(sleepTime);
}
