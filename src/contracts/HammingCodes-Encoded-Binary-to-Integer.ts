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

import type { NS } from '@ns';
import { parseFlags } from 'util/flags';
import { isString } from 'util/validate';

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

    if (!isString(contractData)) {
        ns.writePort(contractPortNum, JSON.stringify(null));
        return;
    }

    ns.tprintf('contract data: %s', JSON.stringify(contractData));
    const answer = solve(contractData);
    ns.writePort(contractPortNum, answer);
}

/**
 * Decode extended Hamming code to an integer.
 */
export function solve(data: string): number {
    let err = 0;
    const bits: number[] = [];

    const bitStringArray = data.split('');
    for (let i = 0; i < bitStringArray.length; ++i) {
        const bit = parseInt(bitStringArray[i]);
        bits[i] = bit;

        if (bit) {
            err ^= +i;
        }
    }

    /* If err != 0 then it spells out the index of the bit that was flipped */
    if (err) {
        /* Flip to correct */
        bits[err] = bits[err] ? 0 : 1;
    }

    /* Now we have to read the message, bit 0 is unused (it's the overall parity bit
     * which we don't care about). Each bit at an index that is a power of 2 is
     * a parity bit and not part of the actual message. */

    let ans = '';

    for (let i = 1; i < bits.length; i++) {
        /* i is not a power of two so it's not a parity bit */
        if ((i & (i - 1)) != 0) {
            ans += bits[i];
        }
    }

    return parseInt(ans, 2);
}
