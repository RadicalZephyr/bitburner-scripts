import type { NS } from 'netscript';
import { parseFlags } from 'util/flags';

import { CONTRACTS } from 'all-contracts';

export async function main(ns: NS) {
    await parseFlags(ns, []);

    const failures = {};
    for (const contract of CONTRACTS) {
        if (contract.answer !== 'null') {
            const reward = ns.codingcontract.attempt(
                contract.answer,
                contract.file,
                contract.host,
            );
            if (reward) {
                ns.tprintf('solved %s, %s', contract.type, reward);
            } else {
                if (failures[contract.type]) {
                    failures[contract.type].push(contract);
                } else {
                    failures[contract.type] = [contract];
                }
            }
        }
    }

    for (const contractType in failures) {
        const contractFailures = failures[contractType];
        ns.tprintf(
            'failed %s contracts of type %s:',
            contractFailures.length,
            contractType,
        );

        for (const contract of contractFailures) {
            ns.tprintf(
                ' failed %s on host %s\ndata: %s\nanswer: %s',
                contract.file,
                contract.host,
                JSON.stringify(contract.data),
                contract.answer,
            );
        }
    }
}
