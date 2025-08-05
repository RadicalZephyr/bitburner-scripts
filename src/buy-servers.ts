import type { AutocompleteData, NS } from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

import { ServerPurchaseClient } from 'services/client/server_purchase';

const FLAGS = [
    ['urgency', 100],
    ['halt', false],
    ['help', false],
] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

export async function main(ns: NS) {
    const options = await parseFlags(ns, FLAGS);

    if (
        options.help
        || typeof options.urgency !== 'number'
        || typeof options.halt !== 'boolean'
    ) {
        ns.tprint(`
Usage: ${ns.getScriptName()} [--urgency N] [--halt]

Signal the server purchase daemon to buy or upgrade purchased servers, or
halt purchasing when \`--halt\` is specified.

OPTIONS
  --urgency  Urgency level (1-100) controlling check frequency (default 100)
  --halt     Stop purchasing servers
  --help     Show this help message
`);
        return;
    }

    const client = new ServerPurchaseClient(ns);

    if (options.halt) {
        client.buy(false);
        return;
    }

    const urgency = Math.min(Math.max(Math.floor(options.urgency), 1), 100);
    client.setUrgency(urgency);
    client.buy();
}
