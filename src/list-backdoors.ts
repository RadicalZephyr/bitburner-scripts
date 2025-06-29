import type { NS } from "netscript";

import { walkNetworkBFS } from "util/walk";

export async function main(ns: NS) {
    ns.disableLog("sleep");

    const network = walkNetworkBFS(ns);
    const missingBackdoor: string[] = [];

    for (const host of network.keys()) {
        const info = ns.getServer(host);
        if (!info.backdoorInstalled) {
            missingBackdoor.push(host);
        }
        await ns.sleep(0);
    }

    ns.print(`Servers missing backdoors: ${missingBackdoor.length}`);
    for (const host of missingBackdoor) {
        ns.print(` - ${host}`);
    }
}
