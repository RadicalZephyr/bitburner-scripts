import type { NS } from "netscript";

export async function main(ns: NS) {
    const contractData = ns.args[0];
    if (typeof contractData != 'number') {
        return;
    }
    // const host = ns.args[0];
    // if (typeof host != 'string' || !ns.serverExists(host)) {
    //     ns.print('invalid host: %s', host);
    //     return;
    // }

    // let contract = ns.args[1];
    // if (typeof contract != 'string' || !ns.fileExists(contract, host)) {
    //     ns.print('invalid contract, no such file as %s on %s', contract, host);
    //     return;
    // }

    // // Puzzle Input
    // const contractData: number = ns.codingcontract.getData(contract, host);

    const mpf = maxPrimeFactor(contractData);
    ns.tprintf("maxPrimeFactor of %s is %s", contractData, mpf);
    // ns.codingcontract.attempt(mpf, contract, host);
}

function maxPrimeFactor(n: number): number {
    let maxPrime = -1;
    while (n % 2 == 0) {
        n = n / 2;
        maxPrime = 2;
    }

    while (n % 3 == 0) {
        n = n / 3;
        maxPrime = 3;
    }

    for (let i = 5; i <= Math.sqrt(n); i += 6) {
        while (n % i == 0) {
            maxPrime = i;
            n = n / i;
        }
        while (n % (i + 2) == 0) {
            maxPrime = i + 2;
            n = n / (i + 2);
        }
    }

    return n > 4 ? n : maxPrime;
}
