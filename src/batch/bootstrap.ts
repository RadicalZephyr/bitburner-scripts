import type { NS } from "netscript";
import { MEM_TAG_FLAGS } from "services/client/memory_tag";

import { launch } from "services/launch";

export async function main(ns: NS) {
    ns.flags(MEM_TAG_FLAGS);
    await launch(ns, "/batch/task_selector.js", {
        threads: 1,
        longRunning: true,
    });

    await launch(ns, "/batch/monitor.js", {
        threads: 1,
        longRunning: true,
    });
}
