import { describe, expect, test } from '@jest/globals';

import { formatGigaBytes } from 'util/format';

describe('formatGigaBytes', () => {
    test('formats values in GiB', () => {
        expect(formatGigaBytes(1)).toBe('1GiB');
        expect(formatGigaBytes(2)).toBe('2GiB');
        expect(formatGigaBytes(9)).toBe('9GiB');
    });

    test('formats values in TiB', () => {
        expect(formatGigaBytes(1024)).toBe('1TiB');
        expect(formatGigaBytes(2048)).toBe('2TiB');
        expect(formatGigaBytes(9 * 1024)).toBe('9TiB');
    });
});
