import { NS } from 'netscript';

import { walkNetworkBFS } from 'util/walk';

/**
 * Calculate the shortest path to the goalHost from current host.
 *
 * @param ns        - Netscript API instance
 * @param startHost - Host where the search begins from
 * @param goalHost  - Host to find the shortest path to
 */
export async function shortestPath(
    ns: NS,
    startHost: string,
    goalHost: string,
): Promise<string[]> {
    const network = walkNetworkBFS(ns);
    await ns.asleep(0);

    if (!network.get(goalHost)) return [];

    const shortestPaths = dijkstra(network, startHost);
    await ns.asleep(0);

    const path = [];
    let u = goalHost;

    if (shortestPaths.get(u) !== null) {
        while (u !== null) {
            path.push(u);
            const serverInfo = ns.getServer(u);
            if (serverInfo.backdoorInstalled) {
                // Short-circuit when we hit a server with a backdoor
                break;
            }
            u = shortestPaths.get(u);
            await ns.asleep(0);
        }
    }
    path.reverse();
    if (path[0] == startHost) {
        path.shift();
    }
    return path;
}

/**
 * Find the shortest paths from all hosts to the source host.
 *
 * @param {Map<string, string[]>} network
 * @param {string} source
 */
export function dijkstra(
    network: Map<string, string[]>,
    source: string,
): Map<string, string> {
    const Q: Set<string> = new Set();
    const dist = new Map();
    const prev = new Map();
    for (const v of network.keys()) {
        dist.set(v, +Infinity);
        prev.set(v, null);
        Q.add(v);
    }
    dist.set(source, 0);
    while (Array.from(Q.keys()).length > 0) {
        const u = min_distance(dist, Q);
        Q.delete(u);
        const neighbours = network.get(u);
        const unvisitedNeighbours = neighbours.filter((v) => Q.has(v));
        for (const v of unvisitedNeighbours) {
            const alt = dist.get(u) + 1;
            if (alt < dist.get(v) && dist.get(u) != Infinity) {
                dist.set(v, alt);
                prev.set(v, u);
            }
        }
    }

    return prev;
}

/** Find the node with the minimum known distance.
 *
 * @param {Map<string, number} dist
 * @param {Set<string>} unvisited
 */
function min_distance(
    dist: Map<string, number>,
    unvisited: Set<string>,
): string {
    let least = Infinity;
    let leastV = null;
    for (const v of unvisited.keys()) {
        if (dist.get(v) < least) {
            least = dist.get(v);
            leastV = v;
        }
    }
    return leastV;
}
