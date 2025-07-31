import type { AutocompleteData, NS } from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

const FLAGS = [['help', false]] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return data.servers;
}

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

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
