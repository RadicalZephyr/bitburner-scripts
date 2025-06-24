import type { NS } from "netscript";

import { LocalStorage } from "util/localStorage";

export async function main(ns: NS) {
    const flags = ns.flags([
        ['help', false]
    ]);

    const rest = flags._ as string[];
    if (rest.length !== 2 || flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()} KEY VALUE

This script associates the given KEY with the given VALUE in the global localStorage object.

Example:
> run ${ns.getScriptName()} config-name config-value
`);
        return;
    }

    let key = rest[0];
    if (typeof key !== 'string') {
        ns.tprint("this key isn't a string");
        return;
    }

    let value = rest[1];
    if (typeof value !== 'string') {
        ns.tprint("value isn't a string");
        return;
    }

    LocalStorage.setItem(key, value);
}
