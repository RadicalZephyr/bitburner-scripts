import type { AutocompleteData, NS } from 'netscript';
import { ALLOC_ID, MEM_TAG_FLAGS } from 'services/client/memory_tag';
import { parseAndRegisterAlloc } from 'services/client/memory';
import { FlagsSchema } from 'util/flags';

import { CONFIG } from 'hacknet/config';

const FLAGS = [
    ['continue', false],
    ['help', false],
] satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

export async function main(ns: NS) {
    const flags = ns.flags([...FLAGS, ...MEM_TAG_FLAGS]);

    const hashCapacity = ns.hacknet.hashCapacity();
    if (
        typeof flags.help !== 'boolean'
        || flags.help
        || typeof flags.continue !== 'boolean'
        || hashCapacity === 0
    ) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()} [--continue]

Sell all the hashes for cash. Only works with Hacknet Servers not nodes.

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --help      Show this help message
  --continue  Continue to sell hashes perpetually

CONFIGURATION
  HACKNET_sellSleepTime  Delay between sales when --continue is used
`);
        return;
    }

    const allocationId = await parseAndRegisterAlloc(ns, flags);
    if (flags[ALLOC_ID] !== -1 && allocationId === null) {
        return;
    }

    do {
        if (flags.continue) await ns.sleep(CONFIG.sellSleepTime);

        const currentHashes = ns.hacknet.numHashes();

        const cost = ns.hacknet.hashCost('Sell for Money');

        const numToSell = Math.floor(currentHashes / cost);

        ns.hacknet.spendHashes('Sell for Money', '', numToSell);

        const value = numToSell * 1000000;
        ns.print(
            `sold ${numToSell * cost} hashes for $${ns.formatNumber(value)}`,
        );
    } while (flags.continue);
}
