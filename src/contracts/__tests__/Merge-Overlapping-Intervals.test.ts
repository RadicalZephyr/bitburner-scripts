import { describe, expect, test } from '@jest/globals';

import {
    type Range,
    solve as solveMerge,
} from '../Merge-Overlapping-Intervals';

type TestCase = [
    Parameters<typeof solveMerge>[0],
    ReturnType<typeof solveMerge>,
];

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
    ] satisfies TestCase[])('%s', (data: Range[], expected: Range[]) => {
        expect(solveMerge(data)).toEqual(expected);
    });
});
