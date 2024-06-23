/* Subarray with Maximum Sum

You are attempting to solve a Coding Contract.You have 10 tries
remaining, after which the contract will self - destruct.

Given the following integer array, find the contiguous subarray
(containing at least one number) which has the largest sum and
return that sum. 'Sum' refers to the sum of all the numbers in the
subarray.

Ex. data [-8,-7,2,6,6,-7,2,8,-3,-4,4,9,1,0,-8,7,1,4,-1,8,-6,-2,8,2,-6,9,0,0]
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
