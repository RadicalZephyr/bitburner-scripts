import { describe, expect, test } from '@jest/globals';

import { formatRam } from 'util/format';

describe('formatRam', () => {
    test('formats values in GiB', () => {
        expect(formatRam(1)).toBe('1GiB');
        expect(formatRam(2)).toBe('2GiB');
        expect(formatRam(9)).toBe('9GiB');
    });

    test('formats values in TiB', () => {
        expect(formatRam(1024)).toBe('1TiB');
        expect(formatRam(2048)).toBe('2TiB');
        expect(formatRam(9 * 1024)).toBe('9TiB');
    });
});
