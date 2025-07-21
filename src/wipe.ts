import type { NS, ProcessInfo } from "netscript";
import { MEM_TAG_FLAGS } from "services/client/memory_tag";

import { walkNetworkBFS } from 'util/walk';

export async function main(ns: NS) {
    const flags = ns.flags(MEM_TAG_FLAGS);
    ns.disableLog("ALL");

    const network = walkNetworkBFS(ns);
    const allHosts = new Set(network.keys());

    for (const host of allHosts) {
        closeBatchHUDs(ns, ns.ps(host));

        ns.killall(host, true);

        const files = ns.ls(host, ".js");
        for (const file of files) {
            if (!ns.rm(file, host)) {
                ns.print(`failed to delete ${file} on ${host}`);
            }
        }
    }
    await clearPorts(ns);
    ns.tprint("finished cleaning the slate");
}


async function clearPorts(ns: NS) {
    const maxPort = 99999;

    for (let i = 1; i <= maxPort; i++) {
        ns.clearPort(i);
        if (i % 500 === 0) {
            await ns.sleep(10);
        }
    }
}

const hudScripts = new Set(["batch/task_selector.js", "batch/monitor.js", "services/memory.js"]);

function closeBatchHUDs(ns: NS, procs: ProcessInfo[]) {
    for (const p of procs) {
        if (hudScripts.has(p.filename)) {
            ns.ui.closeTail(p.pid);
        }
    }
}
