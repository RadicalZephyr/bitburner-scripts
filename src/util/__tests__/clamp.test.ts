import { describe, expect, test } from '@jest/globals';

import { clamp } from '../clamp';

describe('Clamp', () => {
    test('within bounds returns x', () => {
        expect(clamp(2, 1, 3)).toBe(2);
    });

    test('less than lower bound returns lower bound', () => {
        expect(clamp(0, 1, 3)).toBe(1);
    });

    test('greater than upper bound returns upper bound', () => {
        expect(clamp(4, 1, 3)).toBe(3);
    });

    test('transposed upper and lower bound are applied correctly', () => {
        expect(clamp(0, 3, 1)).toBe(1);
        expect(clamp(4, 3, 1)).toBe(3);
    });
});
