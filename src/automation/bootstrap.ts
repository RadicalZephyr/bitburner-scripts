import type { NS } from 'netscript';
import { MEM_TAG_FLAGS } from 'services/client/memory_tag';

import { LaunchClient } from 'services/client/launch';

export async function main(ns: NS) {
    ns.flags(MEM_TAG_FLAGS);

    const client = new LaunchClient(ns);
    await client.launch('/automation/join-factions.js', {
        threads: 1,
        alloc: { longRunning: true },
    });

    await client.launch('/automation/backdoor-servers.js', {
        threads: 1,
        alloc: { longRunning: true },
    });

    await client.launch('/automation/upgrade-ram.js', {
        threads: 1,
        alloc: { longRunning: true },
    });
}
