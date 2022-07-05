import type { NS } from "netscript";

export async function main(ns: NS) {
    let network = walkNetworkBFS(ns);
    ns.tprintf("found %d nodes", Array.from(network.keys()).length);
    await ns.write("networkJSON.txt", JSON.stringify(Array.from(network.entries()), null, 2), "w");
}

/** Walk the network and return an array of all hosts.
 *
 */
export function walkNetworkBFS(ns: NS): Map<string, string[]> {
    let root = "home";
    let q = [];
    let explored = new Set();
    let network = new Map();

    explored.add(root);
    q.push(root);

    while (q.length > 0) {
        let v = q.shift();

        let edges = ns.scan(v);
        network.set(v, edges);

        for (const w of edges) {
            if (!explored.has(w)) {
                explored.add(w);
                q.push(w);
            }
        }
    }
    return network;
}

export function walkNetworkDFS(ns: NS): Map<string, string[]> {
    let root = "home";
    let s = [];
    let explored = new Set();
    let network = new Map();

    explored.add(root);
    s.push(root);

    while (s.length > 0) {
        let v = s.pop();

        let edges = ns.scan(v);
        network.set(v, edges);
        for (const w of edges) {
            if (!explored.has(w)) {
                explored.add(w);
                s.push(w);
            }
        }
    }
    return network;
}
