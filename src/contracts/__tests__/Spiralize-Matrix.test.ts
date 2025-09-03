import { expect, test } from '@jest/globals';

import { solve as solveSpiral } from '../Spiralize-Matrix';

test('Spiralize Matrix', () => {
    const matrix = [
        [37, 29, 17, 26, 32, 3, 23, 46, 43],
        [38, 44, 35, 22, 44, 38, 2, 29, 4],
        [50, 14, 4, 32, 33, 5, 10, 26, 37],
        [30, 42, 36, 28, 29, 27, 16, 26, 50],
        [11, 37, 23, 39, 18, 45, 19, 38, 33],
        [19, 8, 12, 14, 27, 24, 23, 26, 6],
        [24, 40, 40, 31, 25, 33, 10, 11, 5],
        [20, 34, 36, 45, 28, 28, 44, 13, 2],
        [49, 40, 38, 18, 5, 24, 2, 40, 50],
        [48, 38, 22, 12, 29, 41, 5, 43, 14],
        [18, 14, 12, 35, 43, 43, 43, 7, 24],
        [6, 7, 45, 7, 39, 17, 29, 24, 50],
    ];
    expect(solveSpiral(matrix)).toContain(50);
    expect(solveSpiral(matrix)).toHaveLength(108);
});
