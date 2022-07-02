import type { NS } from "netscript";

import { Edge, Graph } from "./graph.js";

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

function range(n: number): number[] {
    return [...Array(n).keys()];
}
