import type { NS } from 'netscript';
import { MEM_TAG_FLAGS } from 'services/client/memory_tag';

import { LaunchClient } from 'services/client/launch';

export async function main(ns: NS) {
    ns.flags(MEM_TAG_FLAGS);
    const client = new LaunchClient(ns);
    await client.launch('/batch/task_selector.js', {
        threads: 1,
        longRunning: true,
    });

    await client.launch('/batch/monitor.js', {
        threads: 1,
        longRunning: true,
    });
}
