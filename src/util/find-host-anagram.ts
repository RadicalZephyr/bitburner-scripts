import type { AutocompleteData, NS, ScriptArg } from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

import { walkNetworkBFS } from 'util/walk';

const FLAGS = [['help', false]] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return data.servers;
}

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    const rest = flags._ as ScriptArg[];
    if (rest.length === 0 || flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()} ANAGRAM

This script compares the given anagram to all hostnames on the network and
prints out any possible matches.

Example:
  > run ${ns.getScriptName()} oodfundstaff

OPTIONS
  --help  Show this help message
`);
        return;
    }

    const key = rest[0];
    if (typeof key != 'string') {
        ns.tprint('ERROR: ANAGRAM must be a string');
        return;
    }

    const network = walkNetworkBFS(ns);
    const allHosts = [...network.keys()];

    const localeCompare = (a, b) => a.localeCompare(b);

    const needle = key.split('').sort(localeCompare).join('');
    const sortedHostNames = allHosts.map((h) => {
        return {
            ana: h.split('').sort(localeCompare).join(''),
            hostname: h,
        };
    });

    const found = sortedHostNames
        .filter((sh) => sh.ana == needle)
        .map((sh) => sh.hostname);

    if (found.length > 0)
        ns.tprint(
            `${found.length} hosts are an anagram for ${key}: ${found.join(', ')}`,
        );
    else ns.tprint(`no anagrams found for ${key}`);
}
