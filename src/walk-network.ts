import type { NS } from "netscript";

export async function main(ns: NS) {
    let network = walkNetworkBFS(ns);
    ns.tprintf("found %d nodes", Array.from(network.keys()).length);
    await ns.write("networkJSON.txt", JSON.stringify(Array.from(network.entries()), null, 2), "w");
}

export function walkNetworkBFS(ns: NS): Map<string, string[]> {
    return walkNetwork(ns, { 'order': 'breadth' });
}

export function walkNetworkDFS(ns: NS): Map<string, string[]> {
    return walkNetwork(ns, { 'order': 'depth' });
}

export type WalkOrder = 'breadth' | 'depth';

export type WalkOptions = {
    'order': WalkOrder,
};

type NextNodeFn = ((nodes: string[]) => string);

/** Walk the network and return an array of all hosts.
 *
 */
export function walkNetwork(ns: NS, options?: WalkOptions): Map<string, string[]> {
    const nextNode: NextNodeFn = options && options.order === 'depth'
        ? (n) => n.pop()
        : (n) => n.shift();

    let root = 'home';
    let nodesToExplore = [];
    let explored = new Set();
    let network = new Map();

    explored.add(root);
    nodesToExplore.push(root);

    while (nodesToExplore.length > 0) {
        let v = nextNode(nodesToExplore);

        let edges = ns.scan(v);
        network.set(v, edges);

        for (const w of edges) {
            if (!explored.has(w)) {
                explored.add(w);
                nodesToExplore.push(w);
            }
        }
    }
    return network;
}