import type { NS, AutocompleteData } from "netscript";
import { ALLOC_ID, MEM_TAG_FLAGS } from "services/client/memory_tag";
import { parseAndRegisterAlloc } from "services/client/memory";

import { walkNetworkBFS } from 'util/walk';

export function autocomplete(data: AutocompleteData): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    const flags = ns.flags([
        ['goto', false],
        ['startingHost', ns.self().server],
        ['help', false],
        ...MEM_TAG_FLAGS
    ]);

    const rest = flags._ as string[];
    if (rest.length === 0 || flags.help || typeof flags.startingHost != 'string') {
        ns.tprint(`
USAGE: run ${ns.getScriptName()} SERVER_NAME

This script prints the path between two servers in the network.

Example:
  > run ${ns.getScriptName()} n00dles

OPTIONS
  --help           Show this help message
  --startingHost   The host to start the search from
  --goto           If sufficient RAM is available (+25GB) send player to SERVER_NAME
`);
        return;
    }

    const allocationId = await parseAndRegisterAlloc(ns, flags);
    if (flags[ALLOC_ID] !== -1 && allocationId === null) {
        return;
    }

    if (!ns.serverExists(flags.startingHost)) {
        ns.tprintf("start host %s does not exist", flags.startingHost);
        return;
    }

    const goalHost = rest[0];
    if (typeof goalHost !== 'string' || !ns.serverExists(goalHost)) {
        ns.tprintf("goal host %s does not exist", goalHost);
        return;
    }

    const network = walkNetworkBFS(ns);
    const allHosts = new Set(network.keys());
    if (!allHosts.has(goalHost)) {
        ns.tprint("Did not find goal host %s during network scan");
        return;
    }

    const shortestPaths = dijkstra(network, flags.startingHost);

    const S = [];
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

    const goCommand = `go ${S.join(" ; go ")}`;

    if (flags.goto) {
        // Acquire a reference to the terminal text field
        const terminalInput = globalThis["terminal-input"];
        if (!(terminalInput instanceof HTMLInputElement)) return;

        terminalInput.value = goCommand;

        // Get a reference to the React event handler.
        const handler = Object.keys(terminalInput)[1];

        // Perform an onChange event to set some internal values.
        terminalInput[handler].onChange({ target: terminalInput });

        // Simulate an enter press
        terminalInput[handler].onKeyDown({ key: 'Enter', preventDefault: (): void => null });
    } else {
        ns.tprintf(`path to ${goalHost}:\n ${goCommand}`);
    }
}

/** Find the shortest paths from all hosts to the source host.
 *
 * @param {Map<string, string[]>} network
 * @param {string} source
 */
export function dijkstra(network: Map<string, string[]>, source: string): Map<string, string> {
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
        const unvisitedNeighbours = neighbours.filter(v => Q.has(v));
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
