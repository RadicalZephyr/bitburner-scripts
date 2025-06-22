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
    let result = jump(data, 0, 0);
    return result.jumps;
}

type Result = {
    done: boolean,
    jumps: number,
};

function jump(a: number[], i: number, jumps: number): Result {
    let maxJumps = a[i];
    let maxIndex = i + maxJumps;

    // Base case, we can reach the end in one jump.
    if (maxIndex >= (a.length - 1)) {
        return { done: true, jumps: jumps + 1 };
    }

    // Now we know we can't directly reach the end from this start
    // index.
    for (let n = maxIndex; n > i; n--) {
        // No need to check slots with zeroes, they are dead ends.
        if (a[n] === 0) {
            continue;
        }

        // Check the next farthest square we can reach that's not a zero.
        let result = jump(a, n, jumps + 1);
        if (result.done) {
            // TODO: we can't return here, we need to actually check
            // all the routes, find the shortest length, and retain
            // the actual shortest paths we found.
            return result;
        }
    }
    // Checked all the squares we can reach and all were dead ends.
    return { done: false, jumps: jumps };
}
