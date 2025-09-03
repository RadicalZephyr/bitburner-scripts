import { expect, test } from '@jest/globals';

import { solve as solveAJG2 } from '../Array-Jumping-Game-II';

test('Array Jumping Game II', () => {
    expect(solveAJG2([1, 2, 2])).toBe(2);
});
