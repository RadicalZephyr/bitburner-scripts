import { expect, test } from '@jest/globals';

import { solve as solveGridII } from '../Unique-Paths-in-a-Grid-II';

test('Unique Paths Grid II', () => {
    const grid = [
        [0, 1, 0, 1, 0, 0, 0, 0, 0],
        [0, 0, 1, 0, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 1, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 1, 0],
        [0, 1, 0, 0, 1, 0, 0, 0, 0],
    ];
    expect(solveGridII(grid)).toBe(27);
});
