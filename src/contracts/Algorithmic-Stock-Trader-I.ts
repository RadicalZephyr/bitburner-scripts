/* Algorithmic Stock Trader I

You are given the following array of stock prices (which are numbers)
where the i-th element represents the stock price on day i:

72,148,128,33,71,9,2,163,155,107,2,98

Determine the maximum possible profit you can earn using at most one
transaction (i.e. you can only buy and sell the stock once). If no
profit can be made then the answer should be 0. Note that you have to
buy the stock before you can sell it.
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

function solve(data: number[]): any {
    // Goal, find maximum cumulative difference between
    // non-overlapping range ends.

    // Could use a greedy algorithm, buying the first day possible,
    // then selling on the first profitable day of trade. That seems
    // unlikely to be optimal though. That probably means that we need
    // to check all possible solutions.

    // So, how do we check every possible pair? We could scan the
    // array for every possible profitable trade, then if that list is
    // empty, we know there is no possible profit and can return zero.

    let profitableTrades: number[][] = Array.from({ length: data.length - 1 }, (_v, _i) => []);
    for (let i = 0; i < data.length; ++i) {
        for (let j = i + 1; j < data.length; ++j) {
            if (data[i] < data[j]) {
                profitableTrades[i].push(j);
            }
        }
    }

    let maxProfit = 0;

    for (let i = 0; i < data.length; ++i) {
        for (const end of profitableTrades[i]) {
            let profit = data[end] - data[i];
            if (maxProfit < profit) {
                maxProfit = profit;
            }
        }
    }

    return maxProfit;
}
