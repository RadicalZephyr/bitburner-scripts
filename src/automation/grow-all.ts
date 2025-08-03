import type { NS } from 'netscript';

import { shortestPath } from 'util/shortest-path';
import { manualGrow, manualWeaken } from 'util/terminal';
import { walkNetworkBFS } from 'util/walk';

export async function main(ns: NS) {
    const network = walkNetworkBFS(ns);
    const hosts = network.keys();

    for (const host of hosts) {
        const maxMoney = ns.getServerMaxMoney(host);
        const curMoney = ns.getServerMoneyAvailable(host);
        if (curMoney >= maxMoney * 0.99) continue;

        await manualGrowHost(ns, host);
    }
}

async function manualGrowHost(ns: NS, host: string) {
    const currentHost = ns.singularity.getCurrentServer();
    const path = await shortestPath(ns, currentHost, host);
    await traverseNetworkPath(ns, path);
    await manualGrow();

    const minSecurity = ns.getServerBaseSecurityLevel(host);
    let serverSecurity = ns.getServerSecurityLevel(host);
    while (serverSecurity > minSecurity) {
        await manualWeaken();
        serverSecurity = ns.getServerSecurityLevel(host);
    }
}

async function traverseNetworkPath(ns: NS, path: string[]) {
    for (const host of path) {
        const currentHost = ns.singularity.getCurrentServer();
        if (!ns.singularity.connect(host))
            throw new Error(`failed to connect to ${host} from ${currentHost}`);
    }
    await ns.sleep(0);
}
