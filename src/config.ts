import type { AutocompleteData, NS } from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

import { CONFIG as ServiceConfig } from 'services/config';
import { CONFIG as BatchConfig } from 'batch/config';
import { CONFIG as GoConfig } from 'go/config';
import { CONFIG as StockConfig } from 'stock/config';
import { CONFIG as GangConfig } from 'gang/config';
import { CONFIG as AutomationConfig } from 'automation/config';
import { CONFIG as CorpConfig } from 'corp/config';
import { CONFIG as HacknetConfig } from 'hacknet/config';

const ALL_CONFIGS = [
    ServiceConfig,
    BatchConfig,
    GoConfig,
    StockConfig,
    GangConfig,
    AutomationConfig,
    HacknetConfig,
    CorpConfig,
];

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
        ns.tprint(`All config values:\n\n${formatAllConfigValues()}`);
        return;
    }

    const rest = flags._ as string[];
    if (flags.help || !(rest.length === 1 || rest.length === 2)) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()} KEY [VALUE]

Read and write the configuration values in Local Storage.

With one argument display the current value of that config key.

With two arguments change the config key to a new value.

Please note, values containing spaces must be quoted.

Example:
  > run ${ns.getScriptName()} hackLevelVelocityThreshold
  > run ${ns.getScriptName()} goOpponent Tetrads
  > run ${ns.getScriptName()} goOpponent 'The Black Hand'
  > run ${ns.getScriptName()} --show

OPTIONS
  --help   Show this help message
  --show   Print all configuration values
`);
        return;
    }

    const key = rest[0];
    if (typeof key !== 'string') {
        ns.tprint("this key isn't a string");
        return;
    }
    const value = rest[1];

    for (const config of ALL_CONFIGS) {
        if (Object.hasOwn(config, key)) {
            const prev = config[key];
            if (value) {
                config[key] = value;
                ns.tprint(
                    `${config.prefix}_${key} changed: '${prev}' ⇒ '${config[key]}'`,
                );
            } else {
                ns.tprint(`${config.prefix}_${key} = '${config[key]}'`);
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
    return ALL_CONFIGS.flatMap((c) => uniqueKeys(c));
}

function uniqueKeys(config: (typeof ALL_CONFIGS)[number]): string[] {
    return Object.keys(config).filter((k: string) => !commonKeys.has(k));
}

function formatAllConfigValues() {
    const output = [];
    for (const c of ALL_CONFIGS) {
        output.push(`${c.prefix}:\n  `);
        const keys = uniqueKeys(c).join('\n  ');
        output.push(keys);
        output.push('\n\n');
    }
    return output.join('');
}
