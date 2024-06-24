/* Subarray with Maximum Sum

Given the following integer array, find the contiguous subarray
(containing at least one number) which has the largest sum and
return that sum. 'Sum' refers to the sum of all the numbers in the
subarray.

Ex. data [-8,-7,2,6,6,-7,2,8,-3,-4,4,9,1,0,-8,7,1,4,-1,8,-6,-2,8,2,-6,9,0,0]
*/

import type { NS } from "netscript";

export async function main(ns: NS) {
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

function solve(data: any): any {
    return null;
}
