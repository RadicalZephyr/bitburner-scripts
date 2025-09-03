import { describe, expect, test } from '@jest/globals';

import { solve as solveIP } from '../Generate-IP-Addresses';

describe('Generate IP Addresses', () => {
    test.each([
        ['25525511135', ['255.255.111.35', '255.255.11.135']],
        ['1938718066', ['193.87.180.66']],
        ['2261743611', ['226.174.36.11']],
    ])('%s', (data, expected) => {
        expect(new Set(solveIP(data))).toEqual(new Set(expected));
    });
});
