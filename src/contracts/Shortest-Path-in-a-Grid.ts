/* Shortest Path in a Grid

You are located in the top-left corner of the following grid:

  [[0,0,0,1,0,0,1,0,0,0],
   [0,0,1,0,1,1,1,0,1,1],
   [0,1,0,0,1,0,1,1,0,1],
   [0,0,0,0,0,1,0,0,1,0],
   [0,0,0,0,0,0,0,0,0,0],
   [1,0,0,1,0,1,1,1,0,0]]

You are trying to find the shortest path to the bottom-right corner of
the grid, but there are obstacles on the grid that you cannot move
onto. These obstacles are denoted by '1', while empty spaces are
denoted by 0.

Determine the shortest path from start to finish, if one exists. The
answer should be given as a string of UDLR characters, indicating the
moves along the path

NOTE: If there are multiple equally short paths, any of them is
accepted as answer. If there is no path, the answer should be an empty
string.  NOTE: The data returned for this contract is an 2D array of
numbers representing the grid.

Examples:

    [[0,1,0,0,0],
     [0,0,0,1,0]]

Answer: 'DRRURRD'

    [[0,1],
     [1,0]]

Answer: ''
 */

import type { NS } from "netscript";
import type { ContractData } from '../all-contracts';

export async function main(ns: NS) {
    let contractDataJSON = ns.args[0];
    if (typeof contractDataJSON !== 'string') {
        ns.tprintf('%s contract run with non-string argument. Must be a JSON string containing file, host and contract data.');
        return;
    }
    let contractData: ContractData = JSON.parse(contractDataJSON);
    ns.tprintf('contract data: %s', JSON.stringify(contractData));
}
