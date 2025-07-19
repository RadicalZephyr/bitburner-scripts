/* Proper 2-Coloring of a Graph

You are given the following data, representing a graph:
[7,[[2,4],[1,5],[0,4],[0,6],[0,5]]]

Note that "graph", as used here, refers to the field of graph theory,
and has no relation to statistics or plotting. The first element of
the data represents the number of vertices in the graph. Each vertex
is a unique number between 0 and 6. The next element of the data
represents the edges of the graph. Two vertices u,v in a graph are
said to be adjacent if there exists an edge [u,v]. Note that an edge
[u,v] is the same as an edge [v,u], as order does not matter. You must
construct a 2-coloring of the graph, meaning that you have to assign
each vertex in the graph a "color", either 0 or 1, such that no two
adjacent vertices have the same color. Submit your answer in the form
of an array, where element i represents the color of vertex i. If it
is impossible to construct a 2-coloring of the given graph, instead
submit an empty array.

Examples:

Input: [4, [[0, 2], [0, 3], [1, 2], [1, 3]]]
Output: [0, 0, 1, 1]

Input: [3, [[0, 1], [0, 2], [1, 2]]]
Output: []
 */

import type { NS } from "netscript";
import { MEM_TAG_FLAGS } from "services/client/memory_tag";

export async function main(ns: NS) {
    const flags = ns.flags(MEM_TAG_FLAGS);
    let scriptName = ns.getScriptName();
    let contractPortNum = ns.args[0];
    if (typeof contractPortNum !== 'number') {
        ns.tprintf('%s contract run with non-number answer port argument', scriptName);
        return;
    }
    let contractDataJSON = ns.args[1];
    if (typeof contractDataJSON !== 'string') {
        ns.tprintf('%s contract run with non-string data argument. Must be a JSON string containing file, host and contract data.', scriptName);
        return;
    }
    let contractData: any = JSON.parse(contractDataJSON);
    ns.tprintf('contract data: %s', JSON.stringify(contractData));
    let answer = solve(contractData);
    ns.writePort(contractPortNum, JSON.stringify(answer));
}

export function solve(data: any): any {
    let [numVertices, edges] = data;
    let graph = new Graph(numVertices, edges);

    for (let v = 0; v < numVertices; v++) {
        if (graph.getColor(v) === undefined) {
            if (!colorGraphDfs(graph, v, 0)) {
                return [];
            }
        }
    }

    return graph.getColoring();
}

function nextColor(color: number): number {
    return (color + 1) % 2;
}

function colorGraphDfs(graph: Graph, v: number, color: number): boolean {
    graph.colorVertex(v, color);

    for (const n of graph.neighbors(v)) {
        if (graph.getColor(n) === undefined) {
            // If neighbor is uncolored, color it opposite to the current node.
            if (!colorGraphDfs(graph, n, nextColor(color))) {
                return false;
            }

        } else if (graph.getColor(n) === color) {
            // If graph is colored and it's the same as the current
            // node's color, then this graph is not bipartite, and
            // cannot be properly 2-colored
            return false;
        }
    }
    return true;
}

type Edge = [
    start: number,
    dest: number,
];

type Color = number;

type Vertex = {
    label: number,
    color?: Color,
};

class Graph {
    vertices: Vertex[];
    edges: Edge[];
    adjacency: Map<number, Set<number>>;

    constructor(numVertices: number, edges: Edge[]) {
        let vertices: Vertex[] = Array.from({ length: numVertices }, (_v, i) => { return { label: i }; });
        this.vertices = vertices;
        this.edges = edges;
        this.adjacency = makeAdjacencyTable(vertices, edges);
    }

    getColoring(): Color[] {
        return this.vertices.map((v) => v.color !== undefined ? v.color : 0);
    }

    getColor(vertex: number): Color | undefined {
        return this.vertices.at(vertex)?.color;
    }

    colorVertex(vertex: number, color: Color) {
        this.vertices.at(vertex).color = color;
    }

    neighbors(vertex: number): number[] {
        return Array.from(this.adjacency.get(vertex) ?? []);
    }
}

function makeAdjacencyTable(vertices: Vertex[], edges: Edge[]): Map<number, Set<number>> {
    let adjacencyTable = new Map();
    for (const v of vertices) {
        adjacencyTable.set(v.label, new Set());
    }

    for (const e of edges) {
        const l = e[0];
        const r = e[1];
        adjacencyTable.get(l).add(r);
        adjacencyTable.get(r).add(l);
    }
    return adjacencyTable;
}
