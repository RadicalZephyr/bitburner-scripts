import type { AutocompleteData, NS } from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

import { CONFIG as BatchConfig } from 'batch/config';
import { CONFIG as GangConfig } from 'gang/config';
import { CONFIG as ServiceConfig } from 'services/config';
import { CONFIG as StockConfig } from 'stock/config';
import { CONFIG as HacknetConfig } from 'hacknet/config';
import { CONFIG as CorpConfig } from 'corp/config';
import { CONFIG as AutomationConfig } from 'automation/config';
import { CONFIG as GoConfig } from 'go/config';

const FLAGS = [
    ['show', false],
    ['help', false],
] satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return allConfigValues();
}

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    if (flags.show) {
        ns.tprint(`All config values: ${allConfigValues().join(', ')}`);
        return;
    }

    const rest = flags._ as string[];
    if (flags.help || !(rest.length === 1 || rest.length === 2)) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()} KEY [VALUE]

This script associates the given KEY with the given VALUE in the global localStorage object.

Example:
> run ${ns.getScriptName()} config-name config-value
`);
        return;
    }

    const key = rest[0];
    if (typeof key !== 'string') {
        ns.tprint("this key isn't a string");
        return;
    }
    const value = rest[1];

    for (const config of [
        BatchConfig,
        GangConfig,
        ServiceConfig,
        StockConfig,
        HacknetConfig,
        CorpConfig,
        AutomationConfig,
        GoConfig,
    ]) {
        if (Object.hasOwn(config, key)) {
            const prev = config[key];
            if (value) {
                config[key] = value;
                ns.tprint(
                    `Config ${config.prefix}_${key} changed from ${prev} to ${config[key]}`,
                );
            } else {
                ns.tprint(`${config.prefix}_${key}='${config[key]}'`);
            }
        }
    }
}

const commonKeys: Set<string> = new Set([
    '_prefix',
    'prefix',
    'entries',
    'defaultSetters',
]);

function allConfigValues(): string[] {
    const allKeys = [
        ...Object.keys(BatchConfig),
        ...Object.keys(GangConfig),
        ...Object.keys(ServiceConfig),
        ...Object.keys(StockConfig),
        ...Object.keys(HacknetConfig),
        ...Object.keys(CorpConfig),
        ...Object.keys(AutomationConfig),
        ...Object.keys(GoConfig),
    ];
    return allKeys.filter((k: string) => !commonKeys.has(k));
}
