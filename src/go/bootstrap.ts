import type { AutocompleteData, NS } from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

import { LaunchClient } from 'services/client/launch';

// NOTE: These flags _must_ be the same as in the root bootstrap script
// because we import and run this main function it sees the same
// arguments as the root bootstrap script received.
const FLAGS = [
    ['minimal', false],
    ['help', false],
] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

export async function main(ns: NS) {
    await parseFlags(ns, FLAGS);

    const client = new LaunchClient(ns);
    const services = ['/go/kataPlay.js'];

    for (const script of services) {
        await client.launch(script, {
            threads: 1,
            alloc: { longRunning: true },
        });
    }
}
