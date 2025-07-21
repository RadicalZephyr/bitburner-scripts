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
 * Maximum profit with at most two transactions.
 */
export async function solve(_ns: NS, data: number[]): Promise<number> {
  if (data.length === 0) return 0;

  const n = data.length;
  const left: number[] = Array(n).fill(0);
  let minPrice = data[0];
  for (let i = 1; i < n; i++) {
    minPrice = Math.min(minPrice, data[i]);
    left[i] = Math.max(left[i - 1], data[i] - minPrice);
  }

  const right: number[] = Array(n).fill(0);
  let maxPrice = data[n - 1];
  for (let i = n - 2; i >= 0; i--) {
    maxPrice = Math.max(maxPrice, data[i]);
    right[i] = Math.max(right[i + 1], maxPrice - data[i]);
  }

  let result = 0;
  for (let i = 0; i < n; i++) {
    result = Math.max(result, left[i] + right[i]);
  }
  return result;
}
