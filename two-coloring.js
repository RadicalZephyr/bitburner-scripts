/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    ns.tail();
    // Puzzle File and Host
    // TODO: get this from arguments
    const contract = 'contract-563991-Joe\'sGuns.cct';
    const host = 'n00dles';
    // Puzzle Input
    const contractData = ns.codingcontract.getData(contract, host);
    const numVertices = contractData[0];
    const edges = contractData[1];
    ns.printf('contract data %s\n[0] = %s\n[1] = %s', JSON.stringify(contractData), numVertices, edges);
    const graph = new Graph(ns, range(numVertices), edges);
}
/**
 * @param {NS} ns
 * @param {Graph} graph
 */
function colorGraph(ns, graph) {
    let coloring = new Coloring(graph);
    let q = [];
    // Choose an arbitrary starting vertex
    const startingVertex = graph.vertices[0];
    coloring.colorVertex(startingVertex, currentColor);
    q.push(startingVertex);
    let currentColor = coloring.firstColor();
    while (q.length > 0) {
        const v = uncolored.shift();
        if (!uncolored.includes(v)) {
            ns.tprintf('iterated too far on an already colored vertex %s', v);
            break;
        }
        const nextColor = coloring.nextColor(currentColor);
        // Assign all neigbors of first vertex other color
        for (const neighbor of graph.neigbors(v)) {
            // Try to color this neigbor
            if (!coloring.colorVertex(neighbor, nextColor)) {
                // If neighbor has wrong color already, return failed coloring
                return [];
            }
        }
    }
    // Assign color green
    // Recurse
}
class Coloring {
    constructor(graph) {
        this.uncolored = Array.from(graph.vertices);
        this.colors = [new Set(), new Set()];
    }
    hasUncolored() {
        return this.uncolored.length > 0;
    }
    isColored(v) {
        return this.uncolored.includes(v) && !(this.greens.has(v) || this.browns.has(v));
    }
    firstColor() {
        return 0;
    }
    nextColor(color) {
        (color + 1) % this.colors.length;
    }
    colorVertex(v, color) {
        const safeColor = color % this.colors.length;
        if (this.uncolored.has(v)) {
            this.colors[safeColor].add(v);
            this.uncolored.delete(v);
        }
        return this.colors[safeColor].has(v);
    }
}
function range(n) {
    return [...Array(n).keys()];
}
class Graph {
    constructor(ns, vertices, edges) {
        ns.printf('vs = %s\nedges = %s', vertices, edges);
        this.ns = ns;
        this.vertices = vertices;
        this.edges = edges;
        this.adjacency = makeAdjacencyTable(ns, vertices, edges);
    }
    neighbors(vertex) {
        return Array.from(this.adjacency[vertex].keys());
    }
}
/**
 * @param {any[]} vertices
 * @param {any[][]} edges
 */
function makeAdjacencyTable(ns, vertices, edges) {
    let adjacencyTable = {};
    for (const v of vertices) {
        ns.printf('init vertex %s', v);
        adjacencyTable[v] = new Set();
    }
    for (const e of edges) {
        const l = e[0];
        const r = e[1];
        ns.printf('adding edge %s - %s', l, r);
        adjacencyTable[l].add(r);
        adjacencyTable[r].add(l);
    }
    return adjacencyTable;
}
