import { describe, expect, test } from '@jest/globals';

import { solve as lzCompress } from '../Compression-III-LZ-Compression';

describe('LZ Compression', () => {
    test.each([
        ['abracadabra', '7abracad47'],
        ['mississippi', '4miss433ppi'],
        ['aAAaAAaAaAA', '3aAA43045'],
        ['2718281828', '627182844'],
        ['abcdefghijk', '9abcdefghi02jk'],
        ['aaaaaaaaaaaa', '3aaa91'],
        ['aaaaaaaaaaaaa', '1a41081'],
        ['aaaaaaaaaaaaaa', '1a41091'],
        ['aaabbaaababababaabb', '5aaabb450723abb'],
        [
            'VqKddddddddrdpUdpUdQtJGa3y6o8G8G8GFHGFHGFH0y0y0y0zlzlzlzlzlzxVanOVanOVanO0ybJtpzFF',
            '4VqKd714rdpU439QtJGa3y6o028G422FH6320y522zl925xVanO8490ybJtpzFF',
        ],
    ])('LZ Compression "%s"', (input, expected) => {
        expect(lzCompress(input)).toBe(expected);
    });
});
