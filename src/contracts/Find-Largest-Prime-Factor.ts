import type { NS } from "netscript";

const CONTRACT_PORT: number = 20;

export async function main(ns: NS) {
    const contractDataArg = ns.args[0];
    if (typeof contractDataArg != 'string') {
        return;
    }
    const contractData = JSON.parse(contractDataArg);

    const answer = maxPrimeFactor(contractData);

    const contractPort = ns.getPortHandle(CONTRACT_PORT);
    contractPort.write(answer);
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
