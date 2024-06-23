// Algorithmic Stock Trader II

// You are given the following array of stock prices(which are
// numbers) where the i - th element represents the stock price on day
// i:

// ex data: [127, 191, 145, 88, 127, 1, 145, 13, 19, 13, 195, 75, 198, 47, 149, 8]

// Determine the maximum possible profit you can earn using as many
// transactions as you'd like. A transaction is defined as buying and
// then selling one share of the stock. Note that you cannot engage in
// multiple transactions at once. In other words, you must sell the
// stock before you buy it again.

// If no profit can be made, then the answer should be 0

import type { NS } from "netscript";
import type { ContractData } from '../contract-locations';

export async function main(ns: NS) {
    let contractDataJSON = ns.args[0];
    if (typeof contractDataJSON !== 'string') {
        ns.tprintf('%s contract run with non-string argument. Must be a JSON string containing file, host and contract data.');
        return;
    }
    let contractData: ContractData = JSON.parse(contractDataJSON);
    ns.tprintf('contract data: %s', JSON.stringify(contractData));
}
