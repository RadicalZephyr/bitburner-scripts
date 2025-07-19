import type { NS, AutocompleteData } from "netscript";
import { ALLOC_ID, MEM_TAG_FLAGS } from "services/client/memory_tag";
import { registerAllocationOwnership } from "services/client/memory";

import { walkNetworkBFS } from 'util/walk';

export function autocomplete(data: AutocompleteData, _args: string[]): string[] {
    return data.scripts;
}

export async function main(ns: NS) {
    const flags = ns.flags([
        ['help', false],
        ...MEM_TAG_FLAGS
    ]);

    if (flags.help) {
        ns.tprint(`
This script kills all running scripts across all running hosts.

USAGE: run ${ns.getScriptName()} [TARGET_SCRIPT...]

OPTIONS:
  TARGET_SCRIPT  script name(s) to kill
  --help         Show this help message

Example:
  > run ${ns.getScriptName()} hack.js
`);
        return;
    }

    let allocationId = flags[ALLOC_ID];
    if (allocationId !== -1) {
        if (typeof allocationId !== 'number') {
            ns.tprint('--allocation-id must be a number');
            return;
        }
        await registerAllocationOwnership(ns, allocationId, "self");
    }

    const targetScripts = new Set(flags._ as string[]);

    const networkGraph = walkNetworkBFS(ns);
    for (const host of networkGraph.keys()) {
        if (targetScripts.size > 0) {
            ns.ps(host)
                .filter(pi => targetScripts.has(pi.filename))
                .forEach(pi => ns.kill(pi.pid));
        } else {
            ns.killall(host, true);
        }
    }
    const message = "SUCCESS: finished stopping scripts";
    ns.toast(message);
    ns.tprint(message)
}
