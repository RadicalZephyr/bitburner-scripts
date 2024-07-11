import type { NS } from "netscript";

import { CONTRACTS } from "all-contracts";

export async function main(ns: NS) {
    for (const contract of CONTRACTS) {
        if (contract.answer !== "null") {
            let reward = ns.codingcontract.attempt(contract.answer, contract.file, contract.host);
            if (reward) {
                ns.tprintf("solved %s, received %s", contract.type, reward);
            }
        }
    }
}
