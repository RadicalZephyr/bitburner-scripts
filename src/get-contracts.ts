import type { NS } from "netscript";

import { CONTRACTS } from './contract-locations';

export async function main(ns: NS) {
    let contracts = [];
    for (let contract of CONTRACTS) {
        let contractType = ns.codingcontract.getContractType(contract.file, contract.host).replace(':', '').replaceAll(' ', '-');
        contract['data'] = ns.codingcontract.getData(contract.file, contract.host);
        contracts.push(contract);

        let contractScriptName = ns.sprintf('contracts/%s.js', contractType)
        if (!ns.fileExists(contractScriptName)) {
            ns.tprintf('no script found for contract type %s from host %s', contractType, contract['host']);
            continue;
        }

        let pid = ns.run(contractScriptName, 1, JSON.stringify(contract));
        if (pid === 0) {
            ns.tprintf('failed to run script for contract %s from host %s', contractType, contract['host']);
        }
    }
    ns.tprintf('\ncontracts = %s\n', JSON.stringify(contracts));
}

