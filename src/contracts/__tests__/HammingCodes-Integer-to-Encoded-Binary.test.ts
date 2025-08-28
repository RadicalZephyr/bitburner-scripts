import { describe, expect, test } from '@jest/globals';

import { solve as hEncode } from '../HammingCodes-Integer-to-Encoded-Binary';

describe('hamming codes', () => {
    test.each([
        [0b1000, '11110000'],
        [0b1010, '01011010'],
        [0b10101, '1001101011'],
        [0b10110, '0011001100'],
        [42609324, '00010010000101001010101010101100'],
    ])('hammingEncoded(%s) == %s', (input, expected) => {
        expect(hEncode(input)).toBe(expected);
    });
});
