import type { NS } from "netscript";

type Edge = [
    start: number,
    dest: number,
];

export async function main(ns: NS) {
    ns.disableLog('ALL');
    ns.tail();

    const host = ns.args[0];
    if (typeof host != 'string' || !ns.serverExists(host)) {
        ns.print('invalid host: %s', host);
        return;
    }

    let contract = ns.args[1];
    if (typeof contract != 'string' || !ns.fileExists(contract, host)) {
        ns.print('invalid contract, no such file as %s on %s', contract, host);
        return;
    }

    // Puzzle Input
    const contractData = ns.codingcontract.getData(contract, host);
    const numVertices: number = contractData[0];
    const edges: Edge[] = contractData[1];

    const graph = new Graph(range(numVertices), edges);
}

function range(n: number): number[] {
    return [...Array(n).keys()];
}

class Graph {
    vertices: number[];
    edges: Edge[];
    adjacency: Map<number, Set<number>>;

    constructor(vertices: number[], edges: Edge[]) {
        this.vertices = vertices;
        this.edges = edges;
        this.adjacency = makeAdjacencyTable(vertices, edges);
    }

    neighbors(vertex: number): number[] {
        return Array.from(this.adjacency.get(vertex).keys());
    }
}

function makeAdjacencyTable(vertices: number[], edges: Edge[]): Map<number, Set<number>> {
    let adjacencyTable = new Map();
    for (const v of vertices) {
        adjacencyTable.set(v, new Set());
    }

    for (const e of edges) {
        const l = e[0];
        const r = e[1];
        adjacencyTable.get(l).add(r);
        adjacencyTable.get(r).add(l);
    }
    return adjacencyTable;
}
