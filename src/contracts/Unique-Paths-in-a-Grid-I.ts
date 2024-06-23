/* Unique Paths in a Grid I

You are in a grid with 4 rows and 6 columns, and you are positioned in
the top-left corner of that grid. You are trying to reach the
bottom-right corner of the grid, but you can only move down or right
on each step. Determine how many unique paths there are from start to
finish.

NOTE: The data returned for this contract is an array with the number
of rows and columns:

[4, 6]
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
