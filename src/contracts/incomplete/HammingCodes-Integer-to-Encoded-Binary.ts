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
import { MEM_TAG_FLAGS } from "services/client/memory_tag";

export async function main(ns: NS) {
    const flags = ns.flags(MEM_TAG_FLAGS);
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

/**
 * Encode an integer using extended Hamming code.
 */
function solve(data: number): string {
    const dataBits = data.toString(2).split("");
    let m = dataBits.length;
    let p = 0;
    while ((1 << p) < m + p + 1) p++;
    const total = m + p + 1;
    const out = Array(total).fill("0");

    let d = m - 1;
    for (let i = total - 1; i >= 0; i--) {
        if (i === 0 || (i & (i - 1)) === 0) {
            continue; // parity bit
        }
        out[i] = dataBits[d--];
    }

    for (let pIndex = 1; pIndex < total; pIndex <<= 1) {
        let parity = 0;
        for (let i = pIndex; i < total; i += 2 * pIndex) {
            for (let j = i; j < i + pIndex && j < total; j++) {
                parity ^= Number(out[j]);
            }
        }
        out[pIndex] = parity.toString();
    }

    const overall = out.slice(1).reduce((a, b) => a ^ Number(b), 0);
    out[0] = overall.toString();
    return out.join("");
}

