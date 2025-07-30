import type { AutocompleteData, NS } from 'netscript';

import { ALLOC_ID, MEM_TAG_FLAGS } from 'services/client/memory_tag';
import { parseAndRegisterAlloc } from 'services/client/memory';

const FLAGS = [['help', false]] satisfies [
    string,
    string | number | boolean | string[],
][];

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return data.servers;
}

export async function main(ns: NS) {
    const flags = ns.flags([...FLAGS, ...MEM_TAG_FLAGS]);

    const rest = flags._ as string[];
    if (flags.help || rest.length > 1) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()} [TARGET]

Start hacking

Example:
  > run ${ns.getScriptName()} hack.js

OPTIONS:
  TARGET  Host to hack
  --help  Show this help message

`);
        return;
    }

    const allocationId = await parseAndRegisterAlloc(ns, flags);
    if (flags[ALLOC_ID] !== -1 && allocationId === null) {
        return;
    }

    const target = rest[0] ?? 'n00dles';

    const sing = ns.singularity;
    if (sing.isFocused()) {
        sing.setFocus(false);
    }
    sing.connect('home');
    sing.connect(target);

    while (true) {
        await sing.manualHack();
    }
}
