import type { NS, AutocompleteData } from "netscript";

import { walkNetworkBFS } from "./lib";

export function autocomplete(data: AutocompleteData, args: string[]): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    const flags = ns.flags([
        ['startingHost', 'home'],
        ['help', false],
    ]);
    if (flags._.length === 0 || flags.help || typeof flags.startingHost != 'string') {
        ns.tprint(`
USAGE: run ${ns.getScriptName()} SERVER_NAME

This script prints the path between two servers in the network.

Example:
  > run ${ns.getScriptName()} n00dles

OPTIONS
  --help           Show this help message
  --startingHost   The host to start the search from
`);
        return;
    }

    if (!ns.serverExists(flags.startingHost)) {
        ns.tprintf("start host %s does not exist", flags.startingHost);
        return;
    }

    let goalHost = ns.args[0];
    if (typeof goalHost !== 'string' || !ns.serverExists(goalHost)) {
        ns.tprintf("goal host %s does not exist", goalHost);
        return;
    }

    let network = walkNetworkBFS(ns);
    let allHosts = new Set(network.keys());
    if (!allHosts.has(goalHost)) {
        ns.tprint("Did not find goal host %s during network scan");
        return;
    }

    let shortestPaths = dijkstra(network, flags.startingHost);

    let S = [];
    let u = goalHost;

    if (shortestPaths.get(u) !== null) {
        while (u !== null) {
            S.push(u);
            const serverInfo = ns.getServer(u);
            if (serverInfo.backdoorInstalled) {
                // Short-circuit when we hit a server with a backdoor
                break;
            }
            u = shortestPaths.get(u);
            await ns.sleep(1);
        }
    }
    S.reverse();
    if (S[0] == flags.startingHost) {
        S.shift();
    }
    ns.tprintf("path to %s:\n  go %s",
        goalHost,
        S.join(" ; go ")
    );
}

/** Find the shortest paths from all hosts to the source host.
 *
 * @param {Map<string, string[]>} network
 * @param {string} source
 */
export function dijkstra(network: Map<string, string[]>, source: string): Map<string, string> {
    let Q: Set<string> = new Set();
    let dist = new Map();
    let prev = new Map();
    for (const v of network.keys()) {
        dist.set(v, +Infinity);
        prev.set(v, null);
        Q.add(v);
    }
    dist.set(source, 0);
    while (Array.from(Q.keys()).length > 0) {
        let u = min_distance(dist, Q);
        Q.delete(u);
        let neighbours = network.get(u);
        let unvisitedNeighbours = neighbours.filter(v => Q.has(v));
        for (const v of unvisitedNeighbours) {
            let alt = dist.get(u) + 1;
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
function min_distance(dist: Map<string, number>, unvisited: Set<string>): string {
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
