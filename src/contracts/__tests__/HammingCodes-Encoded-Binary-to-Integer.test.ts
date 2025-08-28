import { describe, expect, test } from '@jest/globals';

import { solve as hDecode } from '../incomplete/HammingCodes-Encoded-Binary-to-Integer';

describe('hamming codes', () => {
    test.each([
        ['11110000', 0b1000],
        ['01011010', 0b1010],
        ['1001101011', 0b10101],
        ['0011001100', 0b10110],
        ['00010010000101001010101010101100', 42609324],
    ])('hammingEncoded(%s) == %s', (input, expected) => {
        expect(hDecode(input)).toBe(expected);
    });
});
