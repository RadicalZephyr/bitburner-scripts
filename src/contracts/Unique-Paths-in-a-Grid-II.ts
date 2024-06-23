/* Unique Paths in a Grid II

You are located in the top-left corner of the following grid:

0,1,0,1,0,0,0,0,0,
0,0,1,0,0,0,0,0,0,
1,0,0,0,1,0,0,0,0,
0,0,0,0,0,0,0,0,1,
1,0,0,0,0,0,0,1,0,
0,1,0,0,1,0,0,0,0,

You are trying reach the bottom-right corner of the grid, but you can
only move down or right on each step. Furthermore, there are obstacles
on the grid that you cannot move onto. These obstacles are denoted by
'1', while empty spaces are denoted by 0.

Determine how many unique paths there are from start to finish.

NOTE: The data returned for this contract is an 2D array of numbers
representing the grid.
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
