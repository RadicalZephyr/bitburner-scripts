// You are given a ~200 digit BigInt. Find the square root of this
// number, to the nearest integer.

// The input is a BigInt value. The answer must be the string
// representing the solution's BigInt value. The trailing "n" is not
// part of the string.

// Hint: If you are having trouble, you might consult
// https://en.wikipedia.org/wiki/Methods_of_computing_square_roots

// 76636433936619215452179562233742333839307106325670619753981671189430922829450865344518323009065308986490528168302025704126913718483358983118470218644797269974403770434931285058615020800883942343072767


import type { NS } from "netscript";
import { MEM_TAG_FLAGS } from "services/client/memory_tag";

declare global {
    interface JSON {
        rawJSON: ((string) => any),
    }
    var JSON: JSON;
}

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
        ns.tprintf('%s contract run with non-string data argument. Must be a JSON string of the contract data.', scriptName);
        return;
    }
    // N.B. In order to prevent BitBurner from automatically
    // destroying the bigint by parsing it as a number and truncating
    // it, the numeric string needs to be double quoted, so the actual
    // string we read contains quotation marks that need to be
    // stripped. We could use JSON.parse for this, but it seems
    // simpler to just directly strip the quotation marks.
    const contractData: bigint = BigInt(contractDataJSON.substring(1, contractDataJSON.length - 1));
    ns.tprintf('contract data: %s', contractData.toString());
    const answer = solve(contractData);
    ns.writePort(contractPortNum, answer.toString());
}

export function solve(data: bigint): bigint {
    const s = data;
    const s_str = s.toString();

    // Base an estimate on the square root as such `S = a * (10 **
    // 2n)` which implies that `sqrt(S) = sqrt(a) * (10 ** n)`, where
    // `1 <= a < 100`

    // Calculate sqrt(a), where a is the two most significant digits
    // of s
    const a = Math.round(Math.sqrt(JSON.parse(s_str.substring(0, 2))));
    // Calculate n from  for the exponent
    const n = Math.floor((s_str.length - 2) / 2);

    let x_n = BigInt(a) * (10n ** BigInt(n));

    // Now iteratively calculate better approximations to the square
    // root of S using Heron's Method
    const two = BigInt(2);

    while (!(x_n * x_n < s && (x_n + 1n) * (x_n + 1n) > s)) {
        // Exit if a perfect root is found
        if (x_n * x_n == s) return x_n;
        const x_n1 = (x_n + (s / x_n)) / 2n;
        // No change in the estimate, time to exit
        if (x_n == x_n1) break;
        x_n = x_n1;
    }

    const lower = x_n;
    const upper = x_n + 1n;
    return (s - lower * lower) <= (upper * upper - s) ? lower : upper;
}
