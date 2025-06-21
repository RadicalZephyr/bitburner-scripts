/* Find Largest Prime Factor

A prime factor is a factor that is a prime number. What is the largest
prime factor of 129983129?
 */

import type { NS } from "netscript";

import { PRIMES } from "./primes";

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

function solve(data: number): any {
    let factors: number[] = [];

    // copy so we can make sure the product of the factorization is
    // the same.
    let n = data;

    for (const i of PRIMES) {
        if (n === 1 || i > n) {
            break;
        }

        while (n % i == 0) {
            n = n / i;
            factors.push(i);
        }
    }

    let product = factors.reduce((prev, cur) => prev * cur, 1);

    if (product === data) {
        return factors[factors.length - 1];
    } else {
        return null;
    }
}
