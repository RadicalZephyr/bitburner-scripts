import type { NS } from 'netscript';
import { MEM_TAG_FLAGS } from 'services/client/memory_tag';

import { walkNetworkBFS } from 'util/walk';

export async function main(ns: NS) {
    ns.flags(MEM_TAG_FLAGS);
    ns.disableLog('ALL');

    const network = walkNetworkBFS(ns);
    const allHosts = new Set(network.keys());

    for (const host of allHosts) {
        const files = ns.ls(host, '.js');
        for (const file of files) {
            if (!ns.rm(file, host)) {
                ns.print(`failed to delete ${file} on ${host}`);
            }
        }
    }
}
