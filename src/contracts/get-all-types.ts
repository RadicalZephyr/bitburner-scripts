import type { NS } from "netscript";

export async function main(ns: NS) {
    let contractTypes = ns.codingcontract.getContractTypes().map(contractType => {
        return contractType.replace(':', '').replaceAll(' ', '-');
    });
    ns.tprintf('%s', JSON.stringify(contractTypes));
    ns.write('contract-types.txt', JSON.stringify(contractTypes), 'w');
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
