import type { NS } from "netscript";

const CONTRACT_PORT: number = 20;

export async function main(ns: NS) {
    const contractDataArg = ns.args[0];
    if (typeof contractDataArg != 'string') {
        return;
    }
    const contractData = JSON.parse(contractDataArg);

    const answer = solve(contractData);

    const contractPort = ns.getPortHandle(CONTRACT_PORT);
    contractPort.write(answer);
}

function solve(contractData: any): any {
    const numVertices: number = contractData[0];
    const edges: Edge[] = contractData[1];

    const graph = new Graph(range(numVertices), edges);

}

type Edge = [
    start: number,
    dest: number,
];

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
