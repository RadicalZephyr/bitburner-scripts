import type { NS } from "netscript";
import { ALLOC_ID, MEM_TAG_FLAGS } from "services/client/memory_tag";
import { parseAndRegisterAlloc } from "services/client/memory";

import { walkNetworkBFS } from 'util/walk';

export async function main(ns: NS) {
    const flags = ns.flags([
        ['help', false],
        ...MEM_TAG_FLAGS
    ]);

    if (flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

This script gracefully shuts down the batch hacking system by killing all
harvest scripts and the manager, monitor, discovery and memory services.

OPTIONS:
--help         Show this help message

Example:
> run ${ns.getScriptName()}
`);
        return;
    }

    const allocationId = await parseAndRegisterAlloc(ns, flags);
    if (flags[ALLOC_ID] !== -1 && allocationId === null) {
        return;
    }

    const scripts = ["services/discover.js", "services/memory.js", "services/port.js", "batch/task_selector.js", "batch/monitor.js", "batch/harvest.js"];
    ns.spawn("stopworld.js", { threads: 1, spawnDelay: 0 }, ...scripts);
}
