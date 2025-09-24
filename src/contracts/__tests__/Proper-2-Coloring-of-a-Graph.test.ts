import { describe, expect, test } from '@jest/globals';

import { solve as solveColor } from '../Proper-2-Coloring-of-a-Graph';

type TestCase = [
    Parameters<typeof solveColor>[0],
    ReturnType<typeof solveColor>,
];

describe('Proper 2 Coloring', () => {
    test.each([
        [
            [
                4,
                [
                    [0, 2],
                    [0, 3],
                    [1, 2],
                    [1, 3],
                ],
            ],
            [0, 0, 1, 1],
        ],
        [
            [
                3,
                [
                    [0, 1],
                    [0, 2],
                    [1, 2],
                ],
            ],
            [],
        ],
        [
            [
                7,
                [
                    [2, 4],
                    [1, 5],
                    [0, 4],
                    [0, 6],
                    [0, 5],
                ],
            ],
            [0, 0, 0, 0, 1, 1, 1],
        ],
    ] satisfies TestCase[])(
        '%s',
        (data: [number, [number, number][]], expected) => {
            expect(solveColor(data)).toEqual(expected);
        },
    );
});
