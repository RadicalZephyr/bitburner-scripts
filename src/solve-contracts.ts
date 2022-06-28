import type { NS } from "netscript";

import { walkNetworkBFS } from "./walk-network.js";

type Contract = {
    file: string,
    host: string,
    contract_name: string,
};

export async function main(ns: NS) {
    const network = walkNetworkBFS(ns);
    const allHosts = Array.from(network.keys());

    let contracts: Contract[] = [];

    for (const host of allHosts) {
        if (host == "home") continue;

        const localContracts = ns.ls(host, ".cct").map(f => {
            return {
                'file': f,
                'host': host,
                'contract_name': ns.codingcontract.getContractType(f, host)
            };
        });

        if (localContracts.length > 0) contracts.push(...localContracts);
    }

    for (const contract of contracts) {
        const programName = '/contracts/' + contract.contract_name.replaceAll(' ', '-') + '.js';
        if (ns.fileExists(programName)) {
            if (!ns.run(programName, 1, contract.host, contract.file)) {
                ns.tprint(`Could not run ${programName}, try running manually:
run ${programName} ${contract.host} ${contract.file}
`);
            }
        } else {
            ns.tprint(`Found unsolvable contract of type '${contract.contract_name}' in ${contract.file} on ${contract.host}
Create a script ${programName} to solve this contract type!\n
`);
        }
    }
}
