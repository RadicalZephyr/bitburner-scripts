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
    let profitableTrades: number[][] = Array.from({ length: data.length - 1 }, (_v, _i) => []);
    for (let i = 0; i < data.length; ++i) {
        for (let j = i + 1; j < data.length; ++j) {
            if (data[i] < data[j]) {
                profitableTrades[i].push(j);
            }
        }
    }

    if (profitableTrades.every((trades) => trades.length == 0)) {
        return 0;
    }

    let result = maxRemainingProfit(data, profitableTrades, 0);
    return result.profit;
}

type Result = { profit: number, trade: [number, number][] };

function maxRemainingProfit(data: number[], profitableTrades: number[][], startIndex: number): Result {
    let bestProfit = 0;
    let bestStartIndex = startIndex;
    let bestEndIndex = -1;
    let bestTrades: [number, number][] = [];

    if ((startIndex + 1) >= data.length) {
        return { profit: 0, trade: [] };
    }

    // We need to check skipping days as well because sometimes it's
    // not worth buying on the day after we sell.
    for (; startIndex < data.length - 2; ++startIndex) {
        for (const endIndex of profitableTrades[startIndex]) {
            // Profit for the ith profitable trade starting at startIndex
            let profit = data[endIndex] - data[startIndex];

            // Next index is `endIndex + 1` because if we buy the same day
            // we sell, that's the same as not selling to begin with.
            let bestRemaining = maxRemainingProfit(data, profitableTrades, endIndex + 1);
            let totalProfit = profit + bestRemaining.profit;

            if (bestProfit < totalProfit) {
                bestProfit = totalProfit;
                bestEndIndex = endIndex;
                bestStartIndex = startIndex;
                bestTrades = bestRemaining.trade;
            }
        }
    }
    if (bestEndIndex > -1) {
        bestTrades.push([bestEndIndex, bestStartIndex]);
    }
    return { profit: bestProfit, trade: bestTrades };
}
