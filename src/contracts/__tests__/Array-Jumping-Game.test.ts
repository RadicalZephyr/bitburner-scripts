import { expect, test } from '@jest/globals';

import { solve as solveAJG } from '../Array-Jumping-Game';

test('Array Jumping Game', () => {
    expect(solveAJG([7, 5, 7, 0, 0, 3, 0, 0, 5, 7, 0])).toBe(1);
});
