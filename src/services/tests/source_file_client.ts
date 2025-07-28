import type { NS } from 'netscript';
import { MEM_TAG_FLAGS } from 'services/client/memory_tag';
import { SourceFileClient } from 'services/client/source_file';

export async function main(ns: NS) {
    const flags = ns.flags([['sf', 4], ['help', false], ...MEM_TAG_FLAGS]);
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
