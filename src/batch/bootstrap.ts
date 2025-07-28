import type { NS } from 'netscript';
import { MEM_TAG_FLAGS } from 'services/client/memory_tag';

import { LaunchClient } from 'services/client/launch';

export async function main(ns: NS) {
    ns.flags(MEM_TAG_FLAGS);
    const client = new LaunchClient(ns);
    const services = ['/batch/task_selector.js', '/batch/monitor.js'];

    for (const script of services) {
        await client.launch(script, {
            threads: 1,
            alloc: { longRunning: true },
        });
    }
}
