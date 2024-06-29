import type { NS } from "netscript";
import type { ContractData } from "all-contracts";

import { walkNetworkBFS } from "util/walk";

export async function main(ns: NS) {
    let network = walkNetworkBFS(ns);
    let allHosts = Array.from(network.keys());

    const contractPortNum = 266; // "CON"
    const contractFile = /\.cct/;

    let contractPort = ns.getPortHandle(contractPortNum);
    let contracts: ContractData[] = [];

    let incompleteScriptContracts = [];
    let missingScriptContracts = [];

    for (const host of allHosts) {
        if (host == "home") { continue; }

        let files = ns.ls(host).filter(file => contractFile.test(file));
        for (const file of files) {
            let contractType = ns.codingcontract.getContractType(file, host).replace(':', '').replaceAll(' ', '-');
            let data = ns.codingcontract.getData(file, host);
            let contract: ContractData = { type: contractType, file: file, host: host, data: data, answer: null };

            let contractScriptName = ns.sprintf('/contracts/%s.js', contractType)
            if (!ns.fileExists(contractScriptName)) {
                let incompleteContractScriptName = ns.sprintf('/contracts/incomplete/%s.js', contractType)
                if (ns.fileExists(incompleteContractScriptName)) {
                    incompleteScriptContracts.push(contract);
                } else {
                    missingScriptContracts.push(contract);
                }
                continue;
            }

            let pid = ns.run(contractScriptName, 1, contractPortNum, JSON.stringify(data));
            if (pid === 0) {
                ns.tprintf('failed to run script for contract %s from host %s', contractType, contract['host']);
            }

            // Wait until the contract solver script finishes.
            while (true) {
                await ns.sleep(100);
                let scriptInfo = ns.getRunningScript(pid);
                if (scriptInfo === null) {
                    break;
                }
            }

            contract.answer = contractPort.read();

            contracts.push(contract);
        }
    }
    let incompleteContractTypes = [...new Set(incompleteScriptContracts.map((c) => c.type))];
    if (incompleteContractTypes.length > 0) {
        incompleteContractTypes.sort();
        ns.tprintf('\ncontracts with no solution: %s', JSON.stringify(incompleteContractTypes, null, 2));
    }

    if (missingScriptContracts.length > 0) {
        ns.tprintf('\nNo scripts found for the following contracts:');
        for (const c of missingScriptContracts) {
            ns.tprintf(' type %s contract %s from host %s', c.file, c.type, c.host);
        }
    }

    let allContractsFile = "all-contracts.js";
    let fileData = ns.sprintf('export let CONTRACTS = %s;', JSON.stringify(contracts));
    ns.write(allContractsFile, fileData, 'w');
}
