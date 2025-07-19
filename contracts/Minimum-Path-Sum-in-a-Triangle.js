/* Minimum Path Sum in a Triangle

Given a triangle, find the minimum path sum from top to bottom. In
each step of the path, you may only move to adjacent numbers in the
row below. The triangle is represented as a 2D array of numbers:

[
         [4],
        [5,1],
       [4,4,5],
      [4,3,2,4],
     [5,8,1,5,8],
    [3,1,8,1,8,9],
   [2,1,3,8,5,5,4],
  [6,8,9,4,9,4,4,7]
]

Example: If you are given the following triangle:

[
     [2],
    [3,4],
   [6,5,7],
  [4,1,8,3]
]

The minimum path sum is 11 (2 -> 3 -> 5 -> 1).
 */
import { MEM_TAG_FLAGS } from "services/client/memory_tag";
export async function main(ns) {
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
    let contractData = JSON.parse(contractDataJSON);
    ns.tprintf('contract data: %s', JSON.stringify(contractData));
    let answer = solve(contractData);
    ns.writePort(contractPortNum, JSON.stringify(answer));
}
export function solve(data) {
    const dp = data[data.length - 1].slice();
    for (let row = data.length - 2; row >= 0; row--) {
        for (let col = 0; col < data[row].length; col++) {
            dp[col] = Math.min(dp[col], dp[col + 1]) + data[row][col];
        }
    }
    return dp[0];
}
