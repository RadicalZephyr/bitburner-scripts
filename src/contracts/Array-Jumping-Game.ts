/* Array Jumping Game

You are given the following array of integers:

7,5,7,0,0,3,0,0,5,7,0

Each element in the array represents your MAXIMUM jump length at that
position. This means that if you are at position i and your maximum
jump length is n, you can jump to any position from i to i+n.

Assuming you are initially positioned at the start of the array,
determine whether you are able to reach the last index.

Your answer should be submitted as 1 or 0, representing true and false
respectively
 */

import type { NS } from "netscript";
import { MEM_TAG_FLAGS } from "services/client/memory_tag";

export async function main(ns: NS) {
    const flags = ns.flags(MEM_TAG_FLAGS);
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
    const contractData: any = JSON.parse(contractDataJSON);
    ns.tprintf('contract data: %s', JSON.stringify(contractData));
    const answer = solve(contractData);
    ns.writePort(contractPortNum, JSON.stringify(answer));
}

export function solve(data: number[]): any {
    return jump(data, 0) ? 1 : 0;
}

function jump(a: number[], i: number): boolean {
    const maxJumps = a[i];
    const maxIndex = i + maxJumps;

    // Base case, we can reach the end in one jump.
    if (maxIndex >= (a.length - 1)) {
        return true;
    }

    // Now we know we can't directly reach the end from this start
    // index.
    for (let n = maxIndex; n > i; n--) {
        // No need to check slots with zeroes, they are dead ends.
        if (a[n] === 0) {
            continue;
        }

        // Check the next farthest square we can reach that's not a zero.
        if (jump(a, n)) {
            return true;
        }
    }
    // Checked all the squares we can reach and all were dead ends.
    return false;
}
