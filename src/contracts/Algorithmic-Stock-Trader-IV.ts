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

import type { NS } from 'netscript';
import { MEM_TAG_FLAGS } from 'services/client/memory_tag';

export async function main(ns: NS) {
    ns.flags(MEM_TAG_FLAGS);
    const scriptName = ns.getScriptName();
    const contractPortNum = ns.args[0];
    if (typeof contractPortNum !== 'number') {
        ns.tprintf(
            '%s contract run with non-number answer port argument',
            scriptName,
        );
        return;
    }
    const contractDataJSON = ns.args[1];
    if (typeof contractDataJSON !== 'string') {
        ns.tprintf(
            '%s contract run with non-string data argument. Must be a JSON string containing file, host and contract data.',
            scriptName,
        );
        return;
    }
    const contractData = JSON.parse(contractDataJSON);
    ns.tprintf('contract data: %s', JSON.stringify(contractData));
    const answer = await solve(ns, contractData);
    ns.writePort(contractPortNum, JSON.stringify(answer));
}

/**
 * Maximum profit with at most k transactions.
 */
export async function solve(
    _ns: NS,
    data1: [number, number[]],
): Promise<number> {
    /*eslint prefer-const: ["error", {"destructuring": "all"}]*/
    let [k, stocks] = data1;
    if (stocks.length === 0 || k === 0) return 0;

    k = Math.min(k, Math.floor(stocks.length / 2));
    const n = stocks.length;
    const dp: number[][] = Array.from({ length: k + 1 }, () =>
        Array(n).fill(0),
    );

    for (let t = 1; t <= k; t++) {
        let maxDiff = -stocks[0];
        for (let d = 1; d < n; d++) {
            dp[t][d] = Math.max(dp[t][d - 1], stocks[d] + maxDiff);
            maxDiff = Math.max(maxDiff, dp[t - 1][d] - stocks[d]);
        }
    }

    return dp[k][n - 1];
}
