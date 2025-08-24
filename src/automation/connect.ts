import type { NS } from 'netscript';

import { shortestPath } from 'util/shortest-path';

/**
 * Traverse the network to connect to a specific host by the shortest
 * path.
 *
 * @remarks
 * Uses Singularity APIs.
 *
 * @param ns          - Netscript API Instance
 * @param destination - Host to connect to
 */
export async function connectTo(ns: NS, destination: string) {
    const currentHost = ns.singularity.getCurrentServer();
    const path = await shortestPath(ns, currentHost, destination);
    for (const host of path) {
        const currentHost = ns.singularity.getCurrentServer();
        if (!ns.singularity.connect(host))
            throw new Error(`failed to connect to ${host} from ${currentHost}`);
    }
}
