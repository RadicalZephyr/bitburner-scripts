import type { AutocompleteData, NS } from "netscript";

import { walkNetworkBFS } from 'util/walk';

export function autocomplete(data: AutocompleteData, _args: string[]): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    const flags = ns.flags([
        ['help', false],
    ]);

    const rest = flags._;
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

    const found = sortedHostNames.find(sh => sh.ana == needle);

    if (found)
        ns.tprint(`found ${found.hostname} is an anagram for ${key}`);
    else
        ns.tprint(`no anagrams found for ${key}`);
}
