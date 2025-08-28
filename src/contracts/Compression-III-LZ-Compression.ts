/* Compression III: LZ Compression

Lempel-Ziv (LZ) compression is a data compression technique which
encodes data using references to earlier parts of the data. In this
variant of LZ, data is encoded in two types of chunk. Each chunk
begins with a length L, encoded as a single ASCII digit from 1 to 9,
followed by the chunk data, which is either:

  1. Exactly L characters, which are to be copied directly into the
     uncompressed data.
  2. A reference to an earlier part of the uncompressed data. To do
     this, the length is followed by a second ASCII digit X: each of
     the L output characters is a copy of the character X places
     before it in the uncompressed data.

For both chunk types, a length of 0 instead means the chunk ends
immediately, and the next character is the start of a new chunk. The
two chunk types alternate, starting with type 1, and the final chunk
may be of either type.

You are given the following input string:
    ILvfvvvvvvvvvvvvvvvvvvvIUvwZF6vIUvwZZF6qf10vb76qf10viwOviwOviwOvUOviwOvUO5Y1QY1QMre6Jp
Encode it using Lempel-Ziv encoding with the minimum possible output length.

Examples (some have other possible encodings of minimal length):
    abracadabra     ->  7abracad47
    mississippi     ->  4miss433ppi
    aAAaAAaAaAA     ->  3aAA53035
    2718281828      ->  627182844
    abcdefghijk     ->  9abcdefghi02jk
    aaaaaaaaaaaa    ->  3aaa91
    aaaaaaaaaaaaa   ->  1a91031
    aaaaaaaaaaaaaa  ->  1a91041
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
    ns.writePort(contractPortNum, answer);
}

/**
 * Encode the string using minimal LZ compression.
 */
export function solve(plain: string): string {
    // for state[i][j]:
    //      if i is 0, we're adding a literal of length j
    //      else, we're adding a backreference of offset i and length j
    let cur_state: (string | null)[][] = Array.from(Array(10), () =>
        Array<string | null>(10).fill(null),
    );
    let new_state: (string | null)[][] = Array.from(Array(10), () =>
        Array<string | null>(10),
    );

    function set(
        state: (string | null)[][],
        i: number,
        j: number,
        str: string,
    ): void {
        const current = state[i][j];
        if (current == null || str.length < current.length) {
            state[i][j] = str;
        }
    }

    // initial state is a literal of length 1
    cur_state[0][1] = '';

    for (let i = 1; i < plain.length; ++i) {
        for (const row of new_state) {
            row.fill(null);
        }
        const c = plain[i];

        // handle literals
        for (let length = 1; length <= 9; ++length) {
            const string = cur_state[0][length];
            if (string == null) {
                continue;
            }

            if (length < 9) {
                // extend current literal
                set(new_state, 0, length + 1, string);
            } else {
                // start new literal
                set(
                    new_state,
                    0,
                    1,
                    string + '9' + plain.substring(i - 9, i) + '0',
                );
            }

            for (let offset = 1; offset <= Math.min(9, i); ++offset) {
                if (plain[i - offset] === c) {
                    // start new backreference
                    set(
                        new_state,
                        offset,
                        1,
                        string
                            + String(length)
                            + plain.substring(i - length, i),
                    );
                }
            }
        }

        // handle backreferences
        for (let offset = 1; offset <= 9; ++offset) {
            for (let length = 1; length <= 9; ++length) {
                const string = cur_state[offset][length];
                if (string == null) {
                    continue;
                }

                if (plain[i - offset] === c) {
                    if (length < 9) {
                        // extend current backreference
                        set(new_state, offset, length + 1, string);
                    } else {
                        // start new backreference
                        set(
                            new_state,
                            offset,
                            1,
                            string + '9' + String(offset) + '0',
                        );
                    }
                }

                // start new literal
                set(new_state, 0, 1, string + String(length) + String(offset));

                // end current backreference and start new backreference
                for (
                    let new_offset = 1;
                    new_offset <= Math.min(9, i);
                    ++new_offset
                ) {
                    if (plain[i - new_offset] === c) {
                        set(
                            new_state,
                            new_offset,
                            1,
                            string + String(length) + String(offset) + '0',
                        );
                    }
                }
            }
        }

        const tmp_state = new_state;
        new_state = cur_state;
        cur_state = tmp_state;
    }

    let result = null;

    for (let len = 1; len <= 9; ++len) {
        let string = cur_state[0][len];
        if (string == null) {
            continue;
        }

        string +=
            String(len) + plain.substring(plain.length - len, plain.length);
        if (result == null || string.length < result.length) {
            result = string;
        } else if (
            string.length == result.length
            && string.localeCompare(result) < 0
        ) {
            result = string;
        }
    }

    for (let offset = 1; offset <= 9; ++offset) {
        for (let len = 1; len <= 9; ++len) {
            let string = cur_state[offset][len];
            if (string == null) {
                continue;
            }

            string += String(len) + '' + String(offset);
            if (result == null || string.length < result.length) {
                result = string;
            } else if (
                string.length == result.length
                && string.localeCompare(result) < 0
            ) {
                result = string;
            }
        }
    }

    return result ?? '';
}
