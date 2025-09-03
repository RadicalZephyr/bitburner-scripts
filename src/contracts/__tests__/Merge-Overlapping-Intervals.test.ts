import { describe, expect, test } from '@jest/globals';

import { solve as solveMerge } from '../Merge-Overlapping-Intervals';

describe('Merge Overlapping Intervals', () => {
    test.each([
        [
            [
                [1, 3],
                [8, 10],
                [2, 6],
                [10, 16],
            ],
            [
                [1, 6],
                [8, 16],
            ],
        ],
        [
            [
                [7, 13],
                [13, 19],
                [18, 24],
            ],
            [[7, 24]],
        ],
    ])('%s', (data: [number, number][], expected) => {
        expect(solveMerge(data)).toEqual(expected);
    });
});
