import type { NS } from 'netscript';
import { parseFlags } from 'util/flags';

import { walkNetworkBFS } from 'util/walk';

export async function main(ns: NS) {
    await parseFlags(ns, []);
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
