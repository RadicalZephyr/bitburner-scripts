import type { NS } from 'netscript';
import { MEM_TAG_FLAGS } from 'services/client/memory_tag';

import { walkNetworkBFS } from 'util/walk';

export async function main(ns: NS) {
    ns.flags(MEM_TAG_FLAGS);
    const network = walkNetworkBFS(ns);
    const allHosts = Array.from(network.keys());

    const scriptFile = /\.(js|script)/;
    const textFile = /\.txt/;
    const litFile = /\.lit/;

    for (const host of allHosts) {
        if (host == 'home') {
            continue;
        }

        const files = ns.ls(host).filter((file) => !scriptFile.test(file));
        const qualifiedNames = [];
        for (const file of files) {
            if (textFile.test(file)) {
                const qualifiedName = '/' + host + '/' + file;
                ns.mv(host, file, qualifiedName);
                qualifiedNames.push(qualifiedName);
            } else if (litFile.test(file)) {
                qualifiedNames.push(file);
            } else {
                // Must be a contract, this script doesn't handle
                // those files anymore.
            }
        }
        if (qualifiedNames.length > 0) {
            ns.scp(qualifiedNames, 'home', host);
        }
    }
}
