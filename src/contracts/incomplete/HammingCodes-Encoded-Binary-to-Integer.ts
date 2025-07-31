/* HammingCodes: Encoded Binary to Integer

You are given the following encoded binary string:
'10001001000000111011111010101100'

 - Decode it as an 'extended Hamming code' and convert it to a decimal value.
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
 - There is a ~55% chance for an altered bit at a random index.
 - Find the possible altered bit, fix it and extract the decimal value.

Examples:
'11110000' passes the parity checks and has data bits of 1000, which
is 8 in binary.

'1001101010' fails the parity checks and needs the last bit to be
corrected to get '1001101011', after which the data bits are found to
be 10101, which is 21 in binary.

For more information on the 'rule' of encoding, refer to Wikipedia
(https://wikipedia.org/wiki/Hamming_code) or the 3Blue1Brown videos on
Hamming Codes. (https://youtube.com/watch?v=X8jsijhllIA)
 */

import type { NS } from 'netscript';
import { parseFlags } from 'util/flags';

export async function main(ns: NS) {
    await parseFlags(ns, []);

    const scriptName = ns.getScriptName();
    const contractPortNum = ns.args[0];
    if (typeof contractPortNum !== 'number') {
        ns.tprintf(
            '%s contract run with non-number answer port argument',
            scriptName,
        );
        return;
    }
    const contractDataJSON = ns.args[1];
    if (typeof contractDataJSON !== 'string') {
        ns.tprintf(
            '%s contract run with non-string data argument. Must be a JSON string containing file, host and contract data.',
            scriptName,
        );
        return;
    }
    const contractData = JSON.parse(contractDataJSON);
    ns.tprintf('contract data: %s', JSON.stringify(contractData));
    const answer = solve(contractData);
    ns.writePort(contractPortNum, JSON.stringify(answer));
}

/**
 * Decode extended Hamming code to an integer.
 */
function solve(data: string): number {
    const bits = data.split('');
    const m = bits.length;

    const parityIndices: number[] = [];
    for (let i = 0; 2 ** i < m; i++) parityIndices.push(2 ** i);
    parityIndices.unshift(0);

    let error = 0;
    for (const p of parityIndices.slice(1)) {
        let parity = 0;
        for (let i = p; i <= m; i += 2 * p) {
            for (let j = i; j < i + p && j <= m; j++)
                parity ^= Number(bits[j - 1]);
        }
        if (parity !== Number(bits[p - 1])) error ^= p;
    }
    const overall = bits.reduce((a, b) => a ^ Number(b), 0);
    if (overall !== 0 && error === 0) error = 1; // overall parity bit
    if (error > 0) {
        const idx = error - 1;
        bits[idx] = bits[idx] === '0' ? '1' : '0';
    }

    const dataBits: string[] = [];
    for (let i = 1; i <= m; i++) {
        if (!parityIndices.includes(i)) dataBits.push(bits[i - 1]);
    }
    return parseInt(dataBits.join(''), 2);
}
