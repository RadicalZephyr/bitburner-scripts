/* HammingCodes: Integer to Encoded Binary

You are given the following decimal value:
163

 - Convert it to a binary representation and encode it as an 'extended
   Hamming code'.
 - The number should be converted to a string of '0' and '1' with no
   leading zeroes.
 - Parity bits are inserted at positions 0 and 2^N.
 - Parity bits are used to make the total number of '1' bits in a
   given set of data even.
 - The parity bit at position 0 considers all bits including parity bits.
 - Each parity bit at position 2^N alternately considers N bits then
   ignores N bits, starting at position 2^N.
 - The endianness of the parity bits is reversed compared to the
   endianness of the data bits:
 - Data bits are encoded most significant bit first and the parity
   bits encoded least significant bit first.
 - The parity bit at position 0 is set last.

Examples:
8 in binary is 1000, and encodes to 11110000 (pppdpddd - where p is a
parity bit and d is a data bit)
21 in binary is 10101, and encodes to 1001101011 (pppdpdddpd)

For more information on the 'rule' of encoding, refer to Wikipedia
(https://wikipedia.org/wiki/Hamming_code) or the 3Blue1Brown videos on
Hamming Codes. (https://youtube.com/watch?v=X8jsijhllIA)
 */

import type { NS } from "netscript";

export async function main(ns: NS) {
    let scriptName = ns.getScriptName();
    let contractPortNum = ns.args[0];
    if (typeof contractPortNum !== 'number') {
        ns.tprintf('%s contract run with non-number answer port argument', scriptName);
        return;
    }
    let contractDataJSON = ns.args[1];
    if (typeof contractDataJSON !== 'string') {
        ns.tprintf('%s contract run with non-string data argument. Must be a JSON string containing file, host and contract data.', scriptName);
        return;
    }
    let contractData: any = JSON.parse(contractDataJSON);
    ns.tprintf('contract data: %s', JSON.stringify(contractData));
    let answer = solve(contractData);
    ns.writePort(contractPortNum, JSON.stringify(answer));
}

function solve(data: any): any {
    return null;
}

function hammingParity(numString: string[]): string[] {
    let enumeratedNum: [string, number][] = numString.map((v, i) => [v, i]);
    let parityNum = enumeratedNum.filter(([v, _i]) => v === "1").map(([_v, i]) => i).reduce((p, c) => p ^ c);
    return toBinaryArray(parityNum);
}

function toBinaryArray(x: number): string[] {
    return Math.abs(x).toString(2).split('');
}

function codeLength(data: string[]): number {
    let dataLen = data.length;
    let n = 0;
    let codeLen = 1;
    while (dataLen > 0) {
        let d = dBits(n);
        dataLen -= d;
        codeLen += 1 + d;
        n += 1;
    }
    return codeLen + dataLen;
}

function dBits(n: number): number {
    return ((2 ** (n + 1)) - 1) - (2 ** n);
}
