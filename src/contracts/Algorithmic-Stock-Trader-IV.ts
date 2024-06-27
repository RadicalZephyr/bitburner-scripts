/* Algorithmic Stock Trader IV

You are given the following array with two elements:

```
[10, [5,90,66,133,66,57,137,159,102,30,109,193,125,151,40,32,22,79,200,32,141,91,187,164,113,1,175,133,32,123,59,95,103,115,135,171,152,95,69,74,176,152,181,39,48,159,145,17,168,38]]
```

The first element is an integer k. The second element is an array of
stock prices (which are numbers) where the i-th element represents the
stock price on day i.

Determine the maximum possible profit you can earn using at most k
transactions. A transaction is defined as buying and then selling one
share of the stock. Note that you cannot engage in multiple
transactions at once. In other words, you must sell the stock before
you can buy it again.

If no profit can be made, then the answer should be 0.
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

type Trade = {
    startDay: number,
    endDay: number,
    amount: number
};

type TradeSeq = {
    trades: Trade[],
    total: number,
};

function solve(data1: [number, number[]]): any {
    let [k, stocks] = data1;

    let profitableTrades: Trade[] = [];
    for (let i = 0; i < stocks.length - 1; ++i) {
        for (let j = i + 1; j < stocks.length; ++j) {
            if (stocks[i] < stocks[j]) {
                let trade = {
                    startDay: i,
                    endDay: j,
                    amount: stocks[j] - stocks[i]
                };
                profitableTrades.push(trade);
            }
        }
    }

    if (profitableTrades.length == 0) {
        return 0;
    }

    let validTradeSeqs: TradeSeq[] = [];
    for (let tradeSeq of choose(profitableTrades, k)) {
        if (validTradeSequence(tradeSeq)) {
            validTradeSeqs.push({
                trades: tradeSeq,
                total: tradeSeq.reduce((sum, t) => sum + t.amount, 0)
            });
        }
    }
    // What if there are no non-overlapping trade sequences of length
    // `k`, but there are valid sequences of length `k-1`?
    validTradeSeqs.sort((a, b) => b.total - a.total);

    return validTradeSeqs[0].total;
}

function validTradeSequence(trades: Trade[]): boolean {
    trades.sort((a, b) => a.startDay - b.startDay);
    for (let i = 0; i < trades.length - 1; i++) {
        if (trades[i].endDay >= trades[i + 1].startDay) {
            return false;
        }
    }
    return true;
}

function isOverlapping(tradeA: Trade, tradeB: Trade): boolean {
    // Since start is always less than end, this implies that
    // tradeA.startDay < tradeB.startDay
    let aLessThanB = tradeA.endDay < tradeB.startDay;
    let bLessThanA = tradeB.endDay < tradeA.startDay;
    return !(aLessThanB || bLessThanA);
}

function* choose<T>(a: T[], m: number): Iterable<T[]> {
    let n = a.length;
    let c = [];
    for (let i = 0; i != m; i++) {
        c.push(a[n - m + i]);
    }
    yield [...c];
    let p = initTwiddle(m, n);
    while (true) {
        let [done, x, _y, z] = twiddle(p);
        if (done) {
            return;
        }
        c[z] = a[x];
        yield [...c];
    }
}

function initTwiddle(m: number, n: number): number[] {
    let p = [];
    p.push(n + 1);
    let i;
    for (i = 1; i != n - m + 1; i++) {
        p.push(0);
    }
    while (i != n + 1) {
        p.push(i + m - n);
        i++;
    }
    p.push(-2);
    if (m === 0) {
        p[1] = 1;
    }
    return p;
}

function twiddle(p: number[]): [boolean, number, number, number] {
    let x, y, z;
    let done = false;

    let j = 1;
    while (p[j] <= 0) {
        j++;
    }
    if (p[j - 1] == 0) {
        let i;
        for (i = j - 1; i != 1; i--) {
            p[i] = -1;
        }
        p[j] = 0;
        x = z = 0;
        p[1] = 1;
        y = j - 1;
    } else {
        if (j > 1) {
            p[j - 1] = 0;
        }
        do {
            j++;
        } while (p[j] > 0);
        let k = j - 1;
        let i = j;
        while (p[i] == 0) {
            p[i++] = -1;
        }
        if (p[i] == -1) {
            p[i] = p[k];
            z = p[k] - 1;
            x = i - 1;
            y = k - 1;
            p[k] = -1;
        } else {
            if (i === p[0]) {
                done = true;
            } else {
                p[j] = p[i];
                z = p[i] - 1;
                p[i] = 0;
                x = j - 1;
                y = i - 1;
            }
        }
    }

    return [done, x, y, z];
}
