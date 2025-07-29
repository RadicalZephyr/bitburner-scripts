import { describe, expect, test } from '@jest/globals';

import { toIndices, toVertex } from 'go/GtpClient';

describe('vertex/index conversions', () => {
    test('converts basic vertices to indices and back', () => {
        expect(toIndices('a1')).toEqual([0, 0]);
        expect(toVertex(0, 0)).toBe('a1');

        expect(toIndices('c6')).toEqual([2, 5]);
        expect(toVertex(2, 5)).toBe('c6');

        expect(toIndices('t19')).toEqual([18, 18]);
        expect(toVertex(18, 18)).toBe('t19');
    });

    test('handles pass vertex', () => {
        expect(toIndices('pass')).toEqual([-1, -1]);
    });
});
