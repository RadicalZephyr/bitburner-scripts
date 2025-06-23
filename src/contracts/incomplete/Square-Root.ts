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
    let contractData: BigInt = BigInt(contractDataJSON);
    ns.tprintf('contract data: %s', contractDataJson.toString());
    let answer = solve(contractData);
    ns.writePort(contractPortNum, JSON.stringify(answer));
}

function solve(data: BigInt): any {
    return null;
}
