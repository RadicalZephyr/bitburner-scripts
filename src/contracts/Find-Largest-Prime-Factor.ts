/* Find Largest Prime Factor

A prime factor is a factor that is a prime number. What is the largest
prime factor of 129983129?
 */

import type { NS } from "netscript";
import { MEM_TAG_FLAGS } from "services/client/memory_tag";

/**
 * Generate all prime numbers less than or equal to the provided limit using a
 * simple Sieve of Eratosthenes.
 */
function primesUpTo(limit: number): number[] {
    const sieve = new Array(limit + 1).fill(true);
    sieve[0] = false;
    sieve[1] = false;

    for (let i = 2; i * i <= limit; i++) {
        if (!sieve[i]) {
            continue;
        }
        for (let j = i * i; j <= limit; j += i) {
            sieve[j] = false;
        }
    }

    const primes: number[] = [];
    for (let i = 2; i <= limit; i++) {
        if (sieve[i]) {
            primes.push(i);
        }
    }
    return primes;
}
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
    ns.writePort(contractPortNum, JSON.stringify(answer));
}

export function solve(data: number) {
    const factors: number[] = [];

    // copy so we can make sure the product of the factorization is
    // the same.
    let n = data;

    const limit = Math.floor(Math.sqrt(n));
    for (const p of primesUpTo(limit)) {
        while (n % p === 0) {
            n /= p;
            factors.push(p);
        }
    }

    if (n > 1) {
        factors.push(n);
    }

    const product = factors.reduce((prev, cur) => prev * cur, 1);

    if (product === data) {
        return factors[factors.length - 1];
    } else {
        return null;
    }
}
