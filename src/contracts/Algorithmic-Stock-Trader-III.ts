/* Algorithmic Stock Trader III

You are given the following array of stock prices (which are numbers)
where the i-th element represents the stock price on day i:

36,84,162,118,111,59,199,106,23,49,121,77,188,5,191,139,69,104,186,78,73,87,97,193,193,73,68,5,196,169,116,82,180,1,107,123,111,51,184,89,101,3,140,109,85

Determine the maximum possible profit you can earn using at most two
transactions. A transaction is defined as buying and then selling one
share of the stock. Note that you cannot engage in multiple
transactions at once. In other words, you must sell the stock before
you buy it again.

If no profit can be made, then the answer should be 0
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
