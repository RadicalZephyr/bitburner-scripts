import type { NS, AutocompleteData } from "netscript";

import { CONFIG as BatchConfig } from 'batch/config';
import { CONFIG as ServiceConfig } from 'services/config';
import { CONFIG as StockConfig } from 'stock/config';

export function autocomplete(_data: AutocompleteData, args: string[]): string[] {
    return allConfigValues();
}

export async function main(ns: NS) {
    const flags = ns.flags([
        ['show', false],
        ['help', false]
    ]);

    if (flags.show) {
        ns.tprint(`All config values: ${allConfigValues().join(", ")}`);
        return;
    }

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

    for (const config of [BatchConfig, ServiceConfig, StockConfig]) {
        if (Object.hasOwn(config, key)) {
            const prev = config[key];
            config[key] = value;
            ns.tprint(`Config ${config.prefix}_${key} changed from ${prev} to ${config[key]}`);
        }
    }
}

const commonKeys: Set<string> = new Set(["prefix", "entries", "defaultSetters"]);

function allConfigValues(): string[] {
    const allKeys = [
        ...Object.keys(BatchConfig),
        ...Object.keys(ServiceConfig),
        ...Object.keys(StockConfig),
    ];
    return allKeys.filter((k: string) => !commonKeys.has(k));
}
