import type { AutocompleteData, NS } from 'netscript';
import { MEM_TAG_FLAGS } from 'services/client/memory_tag';
import { FlagsSchema } from 'util/flags';

import { SourceFileClient } from 'services/client/source_file';

const FLAGS = [
    ['sf', 4],
    ['help', false],
] satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

export async function main(ns: NS) {
    const flags = ns.flags([...FLAGS, ...MEM_TAG_FLAGS]);
    const sf = flags.sf;
    if (flags.help || typeof sf !== 'number') {
        ns.tprint(`Usage: run ${ns.getScriptName()} --sf N`);
        return;
    }
    const client = new SourceFileClient(ns);
    const level = await client.getLevel(sf);
    ns.tprintf(`SF${sf} level: ${level}`);
    const all = await client.getAll();
    const fromAll = all[sf] ?? 0;
    if (fromAll !== level) {
        ns.tprintf('ERROR: service returned inconsistent data');
    }
}
