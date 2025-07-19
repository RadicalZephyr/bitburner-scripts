/* Compression II: LZ Decompression

Lempel-Ziv (LZ) compression is a data compression technique which
encodes data using references to earlier parts of the data. In this
variant of LZ, data is encoded in two types of chunk. Each chunk
begins with a length L, encoded as a single ASCII digit from 1 to 9,
followed by the chunk data, which is either:

1. Exactly L characters, which are to be copied directly into the
uncompressed data.  2. A reference to an earlier part of the
uncompressed data. To do this, the length is followed by a second
ASCII digit X: each of the L output characters is a copy of the
character X places before it in the uncompressed data.

For both chunk types, a length of 0 instead means the chunk ends
immediately, and the next character is the start of a new chunk. The
two chunk types alternate, starting with type 1, and the final chunk
may be of either type.

You are given the following LZ-encoded string:
    4VqKd714rdpU439QtJGa3y6o028G422FH6320y522zl925xVanO8490ybJtpzFF
Decode it and output the original string.

Example: decoding '5aaabb450723abb' chunk-by-chunk
    5aaabb           ->  aaabb
    5aaabb45         ->  aaabbaaab
    5aaabb450        ->  aaabbaaab
    5aaabb45072      ->  aaabbaaababababa
    5aaabb450723abb  ->  aaabbaaababababaabb
 */
import { MEM_TAG_FLAGS } from "services/client/memory_tag";
export async function main(ns) {
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
    let contractData = JSON.parse(contractDataJSON);
    ns.tprintf('contract data: %s', JSON.stringify(contractData));
    let answer = solve(contractData);
    ns.writePort(contractPortNum, answer);
}
function isDigit(c) {
    return /\d/.test(c);
}
export function solve(data) {
    let uncompressed = "";
    let i = 0;
    let nextChunkType = 0 /* ChunkType.Literal */;
    while (i < data.length) {
        let len = parseInt(data[i]);
        switch (nextChunkType) {
            case 0 /* ChunkType.Literal */:
                if (len > 0) {
                    i += 1;
                    uncompressed += data.substring(i, i + len);
                    i += len;
                }
                else {
                    i += 1;
                }
                nextChunkType = 1 /* ChunkType.BackRef */;
                break;
            case 1 /* ChunkType.BackRef */:
                if (len > 0 && isDigit(data[i + 1])) {
                    // Back reference to uncompressed data
                    let charsBack = parseInt(data[i + 1]);
                    let start = uncompressed.length - charsBack;
                    for (let j = start; j < start + len; ++j) {
                        uncompressed += uncompressed[j];
                    }
                    i += 2;
                }
                else {
                    i += 1;
                }
                nextChunkType = 0 /* ChunkType.Literal */;
                break;
        }
    }
    return uncompressed;
}
