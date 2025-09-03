import { describe, expect, test } from '@jest/globals';

import { solve as solveLZ } from '../Compression-II-LZ-Decompression';

describe('LZ Decompression', () => {
    test.each([
        ['5aaabb450723abb', 'aaabbaaababababaabb'],
        [
            '4VqKd714rdpU439QtJGa3y6o028G422FH6320y522zl925xVanO8490ybJtpzFF',
            'VqKddddddddrdpUdpUdQtJGa3y6o8G8G8GFHGFHGFH0y0y0y0zlzlzlzlzlzxVanOVanOVanO0ybJtpzFF',
        ],
    ])('%s', (compressed, expected) => {
        expect(solveLZ(compressed)).toBe(expected);
    });
});
