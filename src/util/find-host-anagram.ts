import type { AutocompleteData, NS, ScriptArg } from "netscript";
import { ALLOC_ID, MEM_TAG_FLAGS, TAG_ARG } from "services/client/memory_tag";
import { parseAndRegisterAlloc } from "services/client/memory";

import { walkNetworkBFS } from 'util/walk';

export function autocomplete(data: AutocompleteData, _args: string[]): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    const flags = ns.flags([
        ['help', false],
        ...MEM_TAG_FLAGS
    ]);

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

    const allocationId = await parseAndRegisterAlloc(ns, flags);
    if (flags[ALLOC_ID] !== -1 && allocationId === null) {
        return;
    }

    const key = rest[0];
    if (typeof key != "string") {
        ns.tprint("ERROR: ANAGRAM must be a string");
        return;
    }

    let network = walkNetworkBFS(ns);
    let allHosts = [...network.keys()];

    const localeCompare = (a, b) => a.localeCompare(b);

    const needle = key.split("").sort(localeCompare).join("");
    const sortedHostNames = allHosts.map(h => {
        return {
            ana: h.split("").sort(localeCompare).join(""),
            hostname: h
        };
    });

    const found = sortedHostNames.filter(sh => sh.ana == needle).map(sh => sh.hostname);

    if (found.length > 0)
        ns.tprint(`${found.length} hosts are an anagram for ${key}: ${found.join(", ")}`);
    else
        ns.tprint(`no anagrams found for ${key}`);
}
