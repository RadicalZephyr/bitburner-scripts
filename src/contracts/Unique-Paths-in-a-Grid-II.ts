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

export function solve(data: number[][]): number {
    const rows = data.length;
    const cols = data[0].length;

    // dp[r][c] holds number of ways to reach cell r,c avoiding obstacles.
    const dp: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));

    // Start position is blocked
    if (data[0][0] === 1) {
        return 0;
    }
    dp[0][0] = 1;

    // Fill first column
    for (let r = 1; r < rows; r++) {
        if (data[r][0] === 1) {
            dp[r][0] = 0;
        } else {
            dp[r][0] = dp[r - 1][0];
        }
    }

    // Fill first row
    for (let c = 1; c < cols; c++) {
        if (data[0][c] === 1) {
            dp[0][c] = 0;
        } else {
            dp[0][c] = dp[0][c - 1];
        }
    }

    // Fill rest of the table
    for (let r = 1; r < rows; r++) {
        for (let c = 1; c < cols; c++) {
            if (data[r][c] === 1) {
                dp[r][c] = 0;
            } else {
                dp[r][c] = dp[r - 1][c] + dp[r][c - 1];
            }
        }
    }

    return dp[rows - 1][cols - 1];
}
