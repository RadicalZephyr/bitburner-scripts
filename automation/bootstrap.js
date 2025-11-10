import { parseFlags } from 'util/flags';
import { LaunchClient } from 'services/client/launch';
// NOTE: These flags _must_ be the same as in the root bootstrap script
// because we import and run this main function it sees the same
// arguments as the root bootstrap script received.
const FLAGS = [
    ['minimal', false],
    ['help', false],
];
export function autocomplete(data) {
    data.flags(FLAGS);
    return [];
}
export async function main(ns) {
    await parseFlags(ns, FLAGS);
    const client = new LaunchClient(ns);
    const services = [
        '/automation/join-factions.js',
        '/automation/backdoor-servers.js',
        '/automation/purchase-crackers.js',
        '/automation/upgrade-ram.js',
    ];
    for (const script of services) {
        await client.launch(script, {
            threads: 1,
            preventDuplicates: true,
            alloc: { longRunning: true },
        });
    }
}
