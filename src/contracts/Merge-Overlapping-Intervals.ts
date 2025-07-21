/* Merge Overlapping Intervals

Given the following array of arrays of numbers representing a list of
intervals, merge all overlapping intervals.

[[7,13],[13,19],[18,24]]

Example:

[[1, 3], [8, 10], [2, 6], [10, 16]]

would merge into [[1, 6], [8, 16]].

The intervals must be returned in ASCENDING order. You can assume that
in an interval, the first number will always be smaller than the
second.
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
  const answer = solve(contractData);
  ns.writePort(contractPortNum, JSON.stringify(answer));
}

type Range = [number, number];

export function solve(data: Range[]) {
  data.sort((b, c) => b[1] - c[1]);
  data.sort((b, c) => b[0] - c[0]);

  return data.reduce(mergeRanges, []);
}

function mergeRanges(acc: Range[], next: Range): Range[] {
  if (acc.length == 0) {
    return [next];
  }

  const last: Range = acc.at(-1);

  // Sorting means that `last[0] <= next[0]`, so checking if
  // next.start < last.end means these two ranges overlap.
  if (next[0] <= last[1]) {
    if (last[1] < next[1]) {
      // extend the last range if the next one has a larger
      // endpoint
      last[1] = next[1];
    }
  } else {
    acc.push(next);
  }
  return acc;
}

// [[7,12],[2,11],[24,33],[6,14],[4,7],[4,12],[10,16],[6,8],[7,13],[13,21],[8,17],[13,17],[12,18],[10,11],[14,15],[24,25],[2,5],[22,32]]
// [2,5],[2,11],[4,7],[4,12],[6,14],[6,8]

// [[2,5],[2,11],[4,7],[4,12],[6,8],[6,14],[7,12],[7,13],[8,17],[10,11],[10,16],[12,18],[13,17],[13,21],[14,15],[22,32],[24,25],[24,33]]
// [2,5]
