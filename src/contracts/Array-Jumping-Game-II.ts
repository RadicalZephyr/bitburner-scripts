/* Array Jumping Game II

You are given the following array of integers:

1,2,2

Each element in the array represents your MAXIMUM jump length at that
position. This means that if you are at position i and your maximum
jump length is n, you can jump to any position from i to i+n.

Assuming you are initially positioned at the start of the array,
determine the minimum number of jumps to reach the end of the array.

If it's impossible to reach the end, then the answer should be 0.
 */

import type { NS } from "netscript";
import { MEM_TAG_FLAGS } from "services/client/memory_tag";

export async function main(ns: NS) {
    ns.flags(MEM_TAG_FLAGS);
    const scriptName = ns.getScriptName();
    const contractPortNum = ns.args[0];
    if (typeof contractPortNum !== 'number') {
        ns.tprintf('%s contract run with non-number answer port argument', scriptName);
        return;
    }
    const contractDataJSON = ns.args[1];
    if (typeof contractDataJSON !== 'string') {
        ns.tprintf('%s contract run with non-string data argument. Must be a JSON string containing file, host and contract data.', scriptName);
        return;
    }
    const contractData = JSON.parse(contractDataJSON);
    ns.tprintf('contract data: %s', JSON.stringify(contractData));
    const answer = solve(contractData);
    ns.writePort(contractPortNum, answer);
}

export function solve(data: number[]): number {
    if (data.length <= 1) return 0;

    let jumps = 0;
    let currentEnd = 0;
    let farthest = 0;
    for (let i = 0; i < data.length - 1; i++) {
        farthest = Math.max(farthest, i + data[i]);
        if (i === currentEnd) {
            jumps++;
            currentEnd = farthest;
            if (currentEnd >= data.length - 1) return jumps;
        }
    }
    return 0;
}
