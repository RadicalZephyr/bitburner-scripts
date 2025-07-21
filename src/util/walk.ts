import type { NS } from 'netscript';

//////////////////////////////////////////
// Network Walking Utilities
//////////////////////////////////////////

export function walkNetworkBFS(ns: NS): Map<string, string[]> {
  return walkNetwork(ns, { order: 'breadth' });
}

export function walkNetworkDFS(ns: NS): Map<string, string[]> {
  return walkNetwork(ns, { order: 'depth' });
}

export type WalkOrder = 'breadth' | 'depth';

export type WalkOptions = {
  order: WalkOrder;
};

type NextNodeFn = (nodes: string[]) => string;

/** Walk the network and return an array of all hosts.
 *
 */
function walkNetwork(ns: NS, options?: WalkOptions): Map<string, string[]> {
  const nextNode: NextNodeFn =
    options && options.order === 'depth' ? (n) => n.pop() : (n) => n.shift();

  const root = 'home';
  const nodesToExplore = [];
  const explored = new Set();
  const network = new Map();

  explored.add(root);
  nodesToExplore.push(root);

  while (nodesToExplore.length > 0) {
    const v = nextNode(nodesToExplore);

    const edges = ns.scan(v);
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
