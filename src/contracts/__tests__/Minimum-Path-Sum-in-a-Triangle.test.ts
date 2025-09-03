import { expect, test } from '@jest/globals';

import { solve as solveTriangle } from '../Minimum-Path-Sum-in-a-Triangle';

test('Minimum Path Sum Triangle', () => {
    const tri = [
        [4],
        [5, 1],
        [4, 4, 5],
        [4, 3, 2, 4],
        [5, 8, 1, 5, 8],
        [3, 1, 8, 1, 8, 9],
        [2, 1, 3, 8, 5, 5, 4],
        [6, 8, 9, 4, 9, 4, 4, 7],
    ];
    expect(solveTriangle(tri)).toBe(22);
});
