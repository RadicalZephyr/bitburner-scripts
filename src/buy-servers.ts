import type { AutocompleteData, NS } from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

import { ServerPurchaseClient } from 'services/client/server_purchase';

const FLAGS = [
    ['urgency', 100],
    ['help', false],
] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

export async function main(ns: NS) {
    const options = await parseFlags(ns, FLAGS);

    if (options.help || typeof options.urgency !== 'number') {
        ns.tprint(`
Usage: ${ns.getScriptName()} [--urgency N]

Signal the server purchase daemon to buy or upgrade purchased servers.

OPTIONS
  --urgency  Urgency level (1-100) controlling check frequency (default 100)
  --help     Show this help message
`);
        return;
    }

    const urgency = Math.min(Math.max(Math.floor(options.urgency), 1), 100);

    const client = new ServerPurchaseClient(ns);
    client.setUrgency(urgency);
    client.buy();
}
