import type { NS } from 'netscript';
import { MEM_TAG_FLAGS } from 'services/client/memory_tag';

import { LaunchClient } from 'services/client/launch';

export async function main(ns: NS) {
    ns.flags(MEM_TAG_FLAGS);
    const client = new LaunchClient(ns);
    await client.launch('/stock/tracker.js', {
        threads: 1,
        dependencies: ns.ls('/stocks'),
    });

    await client.launch('/stock/trader.js', {
        threads: 1,
    });
}
