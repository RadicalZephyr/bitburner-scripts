import type { NS } from 'netscript';
import { parseFlags } from 'util/flags';

import { LaunchClient } from 'services/client/launch';

export async function main(ns: NS) {
    await parseFlags(ns, []);

    const client = new LaunchClient(ns);
    const services = ['/batch/task_selector.js', '/batch/monitor.js'];

    for (const script of services) {
        await client.launch(script, {
            threads: 1,
            alloc: { longRunning: true },
        });
    }
}
