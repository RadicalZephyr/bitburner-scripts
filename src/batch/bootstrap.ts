import type { NS } from "netscript";

import { launch } from "services/launch";

export async function main(ns: NS) {
    await launch(ns, "/batch/task_selector.js", {
        threads: 1,
        longRunning: true,
        allocationFlag: "--allocation-id"
    });

    await launch(ns, "/batch/monitor.js", {
        threads: 1,
        longRunning: true,
        allocationFlag: "--allocation-id"
    });
}
