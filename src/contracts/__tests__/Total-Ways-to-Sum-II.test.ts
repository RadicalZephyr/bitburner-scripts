import { expect, test } from '@jest/globals';

import { solve as solveSumII } from '../Total-Ways-to-Sum-II';

test('Total Ways to Sum II', () => {
    expect(solveSumII([21, [1, 4, 5, 6, 7, 8, 9, 13]])).toBe(95);
});
