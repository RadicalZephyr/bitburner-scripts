// You are given a ~200 digit BigInt. Find the square root of this
// number, to the nearest integer.

// The input is a BigInt value. The answer must be the string
// representing the solution's BigInt value. The trailing "n" is not
// part of the string.

// Hint: If you are having trouble, you might consult
// https://en.wikipedia.org/wiki/Methods_of_computing_square_roots

// 76636433936619215452179562233742333839307106325670619753981671189430922829450865344518323009065308986490528168302025704126913718483358983118470218644797269974403770434931285058615020800883942343072767


import type { NS } from "netscript";

declare global {
    interface JSON {
        rawJSON: ((string) => any),
    }
    var JSON: JSON;
}

export async function main(ns: NS) {
    let scriptName = ns.getScriptName();
    let contractPortNum = ns.args[0];
    if (typeof contractPortNum !== 'number') {
        ns.tprintf('%s contract run with non-number answer port argument', scriptName);
        return;
    }

    let contractDataJSON = ns.args[1];
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
    let contractData: BigInt = BigInt(contractDataJSON.substring(1, contractDataJSON.length - 1));
    ns.tprintf('contract data: %s', contractData.toString());
    let answer = solve(contractData);
    ns.writePort(contractPortNum, answer.toString());
}

function solve(data: BigInt): BigInt {
    let S = data;
    let s = S.toString();

    // Base an estimate on the square root as such `S = a * (10 **
    // 2n)` which implies that `sqrt(S) = sqrt(a) * (10 ** n)`, where
    // `1 <= a < 100`

    // Calculate sqrt(a), where a is the two most significant digits
    // of s
    let a = Math.round(Math.sqrt(JSON.parse(s.substring(0, 2))));
    // Calculate n from  for the exponent
    let n = Math.floor((s.length - 2) / 2);

    let x_n = BigInt(a * (10 ** n));

    // Now iteratively calculate better approximations to the square
    // root of S using Heron's Method
    let two = BigInt(2);

    while (!(x_n * x_n < S && (x_n + BigInt(1)) * (x_n + BigInt(1)) > S)) {
        let x_n1 = (x_n + (S / x_n)) / two;
        x_n = x_n1;
    }

    return x_n;
}
