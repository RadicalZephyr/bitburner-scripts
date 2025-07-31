import type { NS } from 'netscript';
import { parseFlags } from 'util/flags';

import { LaunchClient } from 'services/client/launch';

export async function main(ns: NS) {
    await parseFlags(ns, []);

    const client = new LaunchClient(ns);
    await client.launch('/stock/tracker.js', {
        threads: 1,
        dependencies: ns.ls('/stocks'),
    });

    await client.launch('/stock/trader.js', {
        threads: 1,
    });
}
