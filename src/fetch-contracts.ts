import type { NS } from "netscript";
import type { ContractData } from "all-contracts";

import { walkNetworkBFS } from "util/walk";

const ALL_CONTRACT_TYPES = [
    "Algorithmic-Stock-Trader-I",
    "Algorithmic-Stock-Trader-II",
    "Algorithmic-Stock-Trader-III",
    "Algorithmic-Stock-Trader-IV",
    "Array-Jumping-Game-II",
    "Array-Jumping-Game",
    "Compression-I-RLE-Compression",
    "Compression-II-LZ-Decompression",
    "Compression-III-LZ-Compression",
    "Encryption-I-Caesar-Cipher",
    "Encryption-II-Vigenère-Cipher",
    "Find-All-Valid-Math-Expressions",
    "Find-Largest-Prime-Factor",
    "Generate-IP-Addresses",
    "HammingCodes-Encoded-Binary-to-Integer",
    "HammingCodes-Integer-to-Encoded-Binary",
    "Merge-Overlapping-Intervals",
    "Minimum-Path-Sum-in-a-Triangle",
    "Proper-2-Coloring-of-a-Graph",
    "Sanitize-Parentheses-in-Expression",
    "Shortest-Path-in-a-Grid",
    "Spiralize-Matrix",
    "Subarray-with-Maximum-Sum",
    "Total-Ways-to-Sum",
    "Total-Ways-to-Sum-II",
    "Unique-Paths-in-a-Grid-II",
    "Unique-Paths-in-a-Grid-I"
];

export function autocomplete(data: AutocompleteData, args: string[]): string[] {
    return ALL_CONTRACT_TYPES;
}

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
                if (!ns.isRunning(pid)) {
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
    let fileData = ns.sprintf('export let CONTRACTS = %s;', JSON.stringify(contracts, null, 2));
    ns.write(allContractsFile, fileData, 'w');
}
