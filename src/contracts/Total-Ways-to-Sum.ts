/* Total Ways to Sum

It is possible write four as a sum in exactly four different ways:

    3 + 1
    2 + 2
    2 + 1 + 1
    1 + 1 + 1 + 1

How many different distinct ways can the number 93 be written as a sum
of at least two positive integers?
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

export function solve(n: number): number {
    const ways = Array(n + 1).fill(0);
    ways[0] = 1;
    for (let i = 1; i <= n; i++) {
        for (let j = i; j <= n; j++) {
            ways[j] += ways[j - i];
        }
    }
    return ways[n] - 1;
}
