import { describe, expect, test } from '@jest/globals';

import { solve as solveShortestGrid } from '../Shortest-Path-in-a-Grid';

describe('Shortest Path in a Grid', () => {
    test.each([
        [
            [
                [0, 1, 0, 0, 0],
                [0, 0, 0, 1, 0],
            ],
            'DRRURRD',
        ],
        [
            [
                [0, 1],
                [1, 0],
            ],
            '',
        ],
        [
            [
                [0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
                [0, 0, 1, 0, 1, 1, 1, 0, 1, 1],
                [0, 1, 0, 0, 1, 0, 1, 1, 0, 1],
                [0, 0, 0, 0, 0, 1, 0, 0, 1, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [1, 0, 0, 1, 0, 1, 1, 1, 0, 0],
            ],
            'DDDDRRRRRRRRDR',
        ],
    ])('%s', (grid, path) => {
        expect(solveShortestGrid(grid)).toBe(path);
    });
});
