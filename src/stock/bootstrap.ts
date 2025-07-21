import type { NS } from 'netscript';
import { MEM_TAG_FLAGS } from 'services/client/memory_tag';

import { launch } from 'services/launch';

export async function main(ns: NS) {
    ns.flags(MEM_TAG_FLAGS);
    await launch(ns, '/stock/tracker.js', {
        threads: 1,
        dependencies: ns.ls('/stocks'),
    });

    await launch(ns, '/stock/trader.js', {
        threads: 1,
    });
}
