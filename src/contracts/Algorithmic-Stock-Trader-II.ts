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
    const answer = solve(contractData);
    ns.writePort(contractPortNum, JSON.stringify(answer));
}

export function solve(data: number[]): number {
    let profit = 0;
    for (let i = 1; i < data.length; i++) {
        const diff = data[i] - data[i - 1];
        if (diff > 0) profit += diff;
    }
    return profit;
}
