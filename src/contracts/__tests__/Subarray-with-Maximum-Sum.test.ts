import { expect, test } from '@jest/globals';

import { solve as solveSubarray } from '../Subarray-with-Maximum-Sum';

test('Subarray Maximum Sum', () => {
    expect(
        solveSubarray([
            -8, -7, 2, 6, 6, -7, 2, 8, -3, -4, 4, 9, 1, 0, -8, 7, 1, 4, -1, 8,
            -6, -2, 8, 2, -6, 9, 0, 0,
        ]),
    ).toBe(40);
});
