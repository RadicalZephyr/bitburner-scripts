import type { NS, AutocompleteData } from "netscript";
import { ALLOC_ID, MEM_TAG_FLAGS, TAG_ARG } from "services/client/memory_tag";
import { parseAndRegisterAlloc } from "services/client/memory";

import { CONFIG as BatchConfig } from 'batch/config';
import { CONFIG as GangConfig } from 'gang/config';
import { CONFIG as ServiceConfig } from 'services/config';
import { CONFIG as StockConfig } from 'stock/config';
import { CONFIG as HacknetConfig } from 'hacknet/config';

export function autocomplete(_data: AutocompleteData, args: string[]): string[] {
    return allConfigValues();
}

export async function main(ns: NS) {
    const flags = ns.flags([
        ['show', false],
        ['help', false],
        ...MEM_TAG_FLAGS
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

    const allocationId = await parseAndRegisterAlloc(ns, flags);
    if (flags[ALLOC_ID] !== -1 && allocationId === null) {
        return;
    }

    let key = rest[0];
    if (typeof key !== 'string') {
        ns.tprint("this key isn't a string");
        return;
    }
    let value = rest[1];

    for (const config of [BatchConfig, GangConfig, ServiceConfig, StockConfig, HacknetConfig]) {
        if (Object.hasOwn(config, key)) {
            const prev = config[key];
            config[key] = value;
            ns.tprint(`Config ${config.prefix}_${key} changed from ${prev} to ${config[key]}`);
        }
    }
}

const commonKeys: Set<string> = new Set(["_prefix", "prefix", "entries", "defaultSetters"]);

function allConfigValues(): string[] {
    const allKeys = [
        ...Object.keys(BatchConfig),
        ...Object.keys(GangConfig),
        ...Object.keys(ServiceConfig),
        ...Object.keys(StockConfig),
        ...Object.keys(HacknetConfig)
    ];
    return allKeys.filter((k: string) => !commonKeys.has(k));
}
