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
    let answer = await solve(ns, contractData);
    ns.writePort(contractPortNum, JSON.stringify(answer));
}

type Trade = {
    startDay: number,
    endDay: number,
    amount: number
};

type TwoTrade = {
    trades: [Trade, Trade],
    total: number,
};

async function solve(ns: NS, data: any): Promise<any> {
    let profitableTrades: Trade[] = [];
    for (let i = 0; i < data.length - 1; ++i) {
        for (let j = i + 1; j < data.length; ++j) {
            if (data[i] < data[j]) {
                let trade = {
                    startDay: i,
                    endDay: j,
                    amount: data[j] - data[i]
                };
                profitableTrades.push(trade);
            }
            await ns.sleep(10);
        }
    }

    if (profitableTrades.length == 0) {
        return 0;
    }

    let twoTrades: TwoTrade[] = [];
    for (const t1 of profitableTrades) {
        for (const t2 of profitableTrades.slice(1)) {
            if (!isOverlapping(t1, t2)) {
                twoTrades.push({
                    trades: [t1, t2],
                    total: t1.amount + t2.amount
                });
            }
            await ns.sleep(10);
        }
    }
    twoTrades.sort((a, b) => b.total - a.total);

    return twoTrades[0].total;
}

function isOverlapping(tradeA: Trade, tradeB: Trade): boolean {
    // Since start is always less than end, this implies that
    // tradeA.startDay < tradeB.startDay
    let aLessThanB = tradeA.endDay < tradeB.startDay;
    let bLessThanA = tradeB.endDay < tradeA.startDay;
    return !(aLessThanB || bLessThanA);
}
