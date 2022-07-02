export type Edge = [
    start: number,
    dest: number,
];

export class Graph {
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
