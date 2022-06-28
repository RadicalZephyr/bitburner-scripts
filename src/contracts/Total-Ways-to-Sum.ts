import type { NS } from "netscript";

export async function main(ns: NS) {
    const options = ns.flags([
        ['help', false],
        ['test', false]
    ]);

    if (options.help) {
        ns.tprint(`
Usage: ${ns.getScriptName()} [OPTIONS] HOST FILE

OPTIONS
  --help   Show this help message
  --test   Provide test data directly in the args
`);
    }

    let contractData;
    if (options.test) {
        contractData = JSON.parse(options._[0]);

        const answer = solve(contractData);

        ns.tprint(`Test run
contract data: '${contractData}'
answer: '${answer}'
`);
    } else {
        const host = options._[0];
        if (typeof host != 'string' || !ns.serverExists(host)) {
            ns.tprintf('invalid host: %s', host);
            return;
        }

        let contract = options._[1];
        if (typeof contract != 'string') {
            ns.tprintf('invalid contract name %s', contract);
            return;
        }

        // Puzzle Input
        const contractData = ns.codingcontract.getData(contract, host);

        const answer = solve(contractData);

        const contractResult = ns.codingcontract.attempt(answer, contract, host);
        if (contractResult) {
            ns.tprintf('Successfully solved contract %s on %s!', contract, host);
        } else {
            ns.tprint(`generated an incorrect answer for ${contract} on ${host}
tries remaining: ${ns.codingcontract.getNumTriesRemaining(contract, host)}
contract data: '${contractData}'
answer: '${answer}'
`);
        }
    }
}

function solve(contractData: any): any {
    return numberOfWays(contractData, contractData - 1);
}

// Function to find the total number of
// ways to represent N as the sum of
// integers over the range [1, K]
function numberOfWays(N: number, K: number): number {

    // Initialize a list
    let dp = Array.from({ length: N + 1 }, (_, i) => 0);

    // Update dp[0] to 1
    dp[0] = 1;

    // Iterate over the range [1, K + 1]
    for (let row = 1; row < K + 1; row++) {

        // Iterate over the range [1, N + 1]
        for (let col = 1; col < N + 1; col++) {

            // If col is greater
            // than or equal to row
            if (col >= row)

                // Update current
                // dp[col] state
                dp[col] = dp[col] + dp[col - row];
        }
    }

    // Return the total number of ways
    return (dp[N]);
}
