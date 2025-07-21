import { solve as solveGridI } from '../Unique-Paths-in-a-Grid-I';
import { solve as solveGridII } from '../Unique-Paths-in-a-Grid-II';
import { solve as solveSpiral } from '../Spiralize-Matrix';
import { solve as solveTriangle } from '../Minimum-Path-Sum-in-a-Triangle';
import { solve as solveShortestGrid } from '../Shortest-Path-in-a-Grid';

import { describe, expect, test } from '@jest/globals';

describe('path finding contract solvers', () => {
    test('Unique Paths Grid I', () => {
        expect(solveGridI([4, 6])).toBe(56);
    });

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

    test('Shortest Path in a Grid', () => {
        const grid1 = [
            [0, 1, 0, 0, 0],
            [0, 0, 0, 1, 0],
        ];
        expect(solveShortestGrid(grid1)).toBe('DRRURRD');

        const grid2 = [
            [0, 1],
            [1, 0],
        ];
        expect(solveShortestGrid(grid2)).toBe('');

        const grid3 = [
            [0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
            [0, 0, 1, 0, 1, 1, 1, 0, 1, 1],
            [0, 1, 0, 0, 1, 0, 1, 1, 0, 1],
            [0, 0, 0, 0, 0, 1, 0, 0, 1, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [1, 0, 0, 1, 0, 1, 1, 1, 0, 0],
        ];
        expect(solveShortestGrid(grid3)).toBe('DDDDRRRRRRRRDR');
    });
});
