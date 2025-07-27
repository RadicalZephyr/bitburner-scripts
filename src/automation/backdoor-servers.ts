import type { NS } from 'netscript';
import { ALLOC_ID, MEM_TAG_FLAGS } from 'services/client/memory_tag';
import { parseAndRegisterAlloc } from 'services/client/memory';

import { canInstallBackdoor, needsBackdoor } from 'util/backdoor';
import { shortestPath } from 'util/shortest-path';

const FACTION_SERVERS = [
    'CSEC',
    'avmnite-02h',
    'I.I.I.I',
    'run4theh111z',
    'fulcrumassets',
];

export async function main(ns: NS) {
    const flags = ns.flags(MEM_TAG_FLAGS);

    const allocationId = await parseAndRegisterAlloc(ns, flags);
    if (flags[ALLOC_ID] !== -1 && allocationId === null) {
        return;
    }

    while (true) {
        if (!FACTION_SERVERS.some((h) => needsBackdoor(ns.getServer(h)))) {
            ns.print('SUCCESS: finished backdooring all faction servers!');
            return;
        }

        const factionMissing = backdoorableFactionServers(ns);

        const startingHost = ns.singularity.getCurrentServer();

        for (const host of factionMissing) {
            const currentHost = ns.singularity.getCurrentServer();
            const path = await shortestPath(ns, currentHost, host);
            traverseNetworkPath(ns, path);
            await ns.singularity.installBackdoor();
            await ns.asleep(0);
        }

        const currentHost = ns.singularity.getCurrentServer();
        if (startingHost !== currentHost) {
            const path = await shortestPath(ns, currentHost, startingHost);
            traverseNetworkPath(ns, path);
        }
    }
}

function backdoorableFactionServers(ns: NS) {
    const factionMissing: string[] = [];
    for (const host of FACTION_SERVERS) {
        const info = ns.getServer(host);
        if (needsBackdoor(info) && canInstallBackdoor(ns, info)) {
            factionMissing.push(host);
        }
    }
    return factionMissing;
}

function traverseNetworkPath(ns: NS, path: string[]) {
    for (const host of path) {
        const currentHost = ns.singularity.getCurrentServer();
        if (!ns.singularity.connect(host))
            throw new Error(`failed to connect to ${host} from ${currentHost}`);
    }
}
