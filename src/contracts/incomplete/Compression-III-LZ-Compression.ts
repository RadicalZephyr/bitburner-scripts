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

import type { NS } from "netscript";
import { MEM_TAG_FLAGS } from "services/client/memory_tag";

export async function main(ns: NS) {
    ns.flags(MEM_TAG_FLAGS);
    const scriptName = ns.getScriptName();
    const contractPortNum = ns.args[0];
    if (typeof contractPortNum !== 'number') {
        ns.tprintf('%s contract run with non-number answer port argument', scriptName);
        return;
    }
    const contractDataJSON = ns.args[1];
    if (typeof contractDataJSON !== 'string') {
        ns.tprintf('%s contract run with non-string data argument. Must be a JSON string containing file, host and contract data.', scriptName);
        return;
    }
    const contractData = JSON.parse(contractDataJSON);
    ns.tprintf('contract data: %s', JSON.stringify(contractData));
    const answer = solve(contractData);
    ns.writePort(contractPortNum, JSON.stringify(answer));
}

enum ChunkType {
    Literal,
    BackRef,
}

/**
 * Encode the string using minimal LZ compression.
 */
function solve(data: string): string {
    const memo = new Map<string, string>();

    function helper(pos: number, type: ChunkType): string {
        if (pos >= data.length) return "";
        const key = `${pos}|${type}`;
        const cached = memo.get(key);
        if (cached !== undefined) return cached;

        let best: string | null = null;

        if (type === ChunkType.Literal) {
            for (let len = 0; len <= 9 && pos + len <= data.length; len++) {
                const chunk = len === 0 ? "0" : `${len}${data.slice(pos, pos + len)}`;
                const cand = chunk + helper(pos + len, ChunkType.BackRef);
                if (best === null || cand.length < best.length) best = cand;
            }
        } else {
            for (let len = 0; len <= 9; len++) {
                if (len === 0) {
                    const cand = "0" + helper(pos, ChunkType.Literal);
                    if (best === null || cand.length < best.length) best = cand;
                } else {
                    for (let dist = 1; dist <= 9; dist++) {
                        if (pos - dist < 0 || pos + len > data.length) continue;
                        let ok = true;
                        for (let j = 0; j < len; j++) {
                            if (data[pos + j] !== data[pos + j - dist]) {
                                ok = false;
                                break;
                            }
                        }
                        if (!ok) continue;
                        const chunk = `${len}${dist}`;
                        const cand = chunk + helper(pos + len, ChunkType.Literal);
                        if (best === null || cand.length < best.length) best = cand;
                    }
                }
            }
        }

        memo.set(key, best!);
        return best!;
    }

    return helper(0, ChunkType.Literal);
}
