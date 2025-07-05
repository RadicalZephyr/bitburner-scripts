import type { NS } from "netscript";

import { walkNetworkBFS } from 'util/walk';

export async function main(ns: NS) {
    const flags = ns.flags([
        ['help', false],
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
