import type { NS } from "netscript";

const CONTRACT_PORT: number = 20;

/* Given the following array of array of numbers representing a list
 * of intervals, merge all overlapping intervals.
 *
 * [[8,17],[16,20],[19,29]]
 *
 * Example:
 *
 * [[1, 3], [8, 10], [2, 6], [10, 16]]
 *
 * would merge into [[1, 6], [8, 16]].
 *
 * The intervals must be returned in ASCENDING order. You can assume
 * that in an interval, the first number will always be smaller than
 * the second.
 */
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

}
