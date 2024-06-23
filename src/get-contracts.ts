import type { NS } from "netscript";

import { CONTRACTS } from './contract-locations';

export async function main(ns: NS) {
    let contracts = [];
    for (let contract of CONTRACTS) {
        let contractType = ns.codingcontract.getContractType(contract.file, contract.host).replaceAll(' ', '-');
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

export type ContractType = "Find-Largest-Prime-Factor"
    | "Subarray-with-Maximum-Sum"
    | "Total-Ways-to-Sum"
    | "Total-Ways-to-Sum-II"
    | "Spiralize-Matrix"
    | "Array-Jumping-Game"
    | "Array-Jumping-Game-II"
    | "Merge-Overlapping-Intervals"
    | "Generate-IP-Addresses"
    | "Algorithmic-Stock-Trader-I"
    | "Algorithmic-Stock-Trader-II"
    | "Algorithmic-Stock-Trader-III"
    | "Algorithmic-Stock-Trader-IV"
    | "Minimum-Path-Sum-in-a-Triangle"
    | "Unique-Paths-in-a-Grid-I"
    | "Unique-Paths-in-a-Grid-II"
    | "Shortest-Path-in-a-Grid"
    | "Sanitize-Parentheses-in-Expression"
    | "Find-All-Valid-Math-Expressions"
    | "HammingCodes:-Integer-to-Encoded-Binary"
    | "HammingCodes:-Encoded-Binary-to-Integer"
    | "Proper-2-Coloring-of-a-Graph"
    | "Compression-I:-RLE-Compression"
    | "Compression-II:-LZ-Decompression"
    | "Compression-III:-LZ-Compression"
    | "Encryption-I:-Caesar-Cipher"
    | "Encryption-II:-Vigenère-Cipher";
