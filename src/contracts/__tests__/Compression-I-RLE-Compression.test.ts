import { describe, expect, test } from '@jest/globals';

import { solve as solveRLE } from '../Compression-I-RLE-Compression';

describe('RLE Compression', () => {
    test.each([
        ['aaaaabccc', '5a1b3c'],
        ['aAaAaA', '1a1A1a1A1a1A'],
        ['111112333', '511233'],
        ['zzzzzzzzzzzzzzzzzzz', '9z9z1z'],
        [
            'QQQQQQQQNXXXXXddW200bbhhhhhhhkkHHHHHuu77ii4GGGGGGGIk44hwwwwwwwwSSEIIIIIIIIrrr2DDppppppppppp6',
            '8Q1N5X2d1W12202b7h2k5H2u272i147G1I1k241h8w2S1E8I3r122D9p2p16',
        ],
    ])('%s', (encoded, expected) => {
        expect(solveRLE(encoded)).toBe(expected);
    });
});
