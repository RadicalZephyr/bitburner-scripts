// You are given a ~200 digit BigInt. Find the square root of this
// number, to the nearest integer.

// The input is a BigInt value. The answer must be the string
// representing the solution's BigInt value. The trailing "n" is not
// part of the string.

// Hint: If you are having trouble, you might consult
// https://en.wikipedia.org/wiki/Methods_of_computing_square_roots

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

function solve(data: BigInt): any {
    return null;
}
