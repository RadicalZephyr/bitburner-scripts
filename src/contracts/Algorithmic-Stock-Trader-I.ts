/* Algorithmic Stock Trader I

You are attempting to solve a Coding Contract. You have 5 tries
remaining, after which the contract will self-destruct.

You are given the following array of stock prices (which are numbers)
where the i-th element represents the stock price on day i:

72,148,128,33,71,9,2,163,155,107,2,98

Determine the maximum possible profit you can earn using at most one
transaction (i.e. you can only buy and sell the stock once). If no
profit can be made then the answer should be 0. Note that you have to
buy the stock before you can sell it.
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
