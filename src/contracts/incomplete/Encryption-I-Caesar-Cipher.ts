/* Encryption I: Caesar Cipher

Caesar cipher is one of the simplest encryption technique. It is a
type of substitution cipher in which each letter in the plaintext is
replaced by a letter some fixed number of positions down the
alphabet. For example, with a left shift of 3, D would be replaced by
A, E would become B, and A would become X (because of rotation).

You are given an array with two elements:
  ["MEDIA MOUSE INBOX VIRUS DEBUG", 10]
The first element is the plaintext, the second element is the left shift value.

Return the ciphertext as uppercase string. Spaces remains the same.
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
    return null;
}
