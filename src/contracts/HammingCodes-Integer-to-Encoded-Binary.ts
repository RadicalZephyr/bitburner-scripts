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

import type { NS } from '@ns';
import { parseFlags } from 'util/flags';
import { isNumber } from 'util/validate';

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

    if (!isNumber(contractData)) {
        ns.writePort(contractPortNum, JSON.stringify(null));
        return;
    }

    ns.tprintf('contract data: %s', JSON.stringify(contractData));
    const answer = solve(contractData);
    ns.writePort(contractPortNum, answer);
}

/**
 * Encode an integer using extended Hamming code.
 */
export function solve(data: number): string {
    const enc: number[] = [0];
    const data_bits: number[] = data
        .toString(2)
        .split('')
        .reverse()
        .map((value) => parseInt(value));

    let k = data_bits.length;

    /* NOTE: writing the data like this flips the endianness, this is what the
     * original implementation by Hedrauta did so I'm keeping it like it was. */
    for (let i = 1; k > 0; i++) {
        if ((i & (i - 1)) != 0) {
            enc[i] = data_bits[--k];
        } else {
            enc[i] = 0;
        }
    }

    let parityNumber = 0;

    /* Figure out the subsection parities */
    for (let i = 0; i < enc.length; i++) {
        if (enc[i]) {
            parityNumber ^= i;
        }
    }

    const parityArray = parityNumber
        .toString(2)
        .split('')
        .reverse()
        .map((value) => parseInt(value));

    /* Set the parity bits accordingly */
    for (let i = 0; i < parityArray.length; i++) {
        enc[2 ** i] = parityArray[i] ? 1 : 0;
    }

    parityNumber = 0;
    /* Figure out the overall parity for the entire block */
    for (let i = 0; i < enc.length; i++) {
        if (enc[i]) {
            parityNumber++;
        }
    }

    /* Finally set the overall parity bit */
    enc[0] = parityNumber % 2 == 0 ? 0 : 1;

    return enc.join('');
}
