import { solve as solveExpr } from '../Find-All-Valid-Math-Expressions';
import { solve as solveIP } from '../Generate-IP-Addresses';
import { solve as solveMerge } from '../Merge-Overlapping-Intervals';
import { solve as solveColor } from '../Proper-2-Coloring-of-a-Graph';
import { solve as solveParens } from '../Sanitize-Parentheses-in-Expression';

import { describe, expect, test } from '@jest/globals';

describe('contract solvers', () => {
    test('Math Expressions', () => {
        expect(new Set(solveExpr(['123', 6]))).toEqual(
            new Set(['1+2+3', '1*2*3']),
        );
        expect(new Set(solveExpr(['105', 5]))).toEqual(
            new Set(['1*0+5', '10-5']),
        );
        expect(solveExpr(['29787', -8])).toEqual(['2-97+87']);
    });

    test('Generate IP Addresses', () => {
        expect(new Set(solveIP('25525511135'))).toEqual(
            new Set(['255.255.111.35', '255.255.11.135']),
        );
        expect(solveIP('1938718066')).toEqual(['193.87.180.66']);
        expect(solveIP('2261743611')).toEqual(['226.174.36.11']);
    });

    test('Merge Overlapping Intervals', () => {
        expect(
            solveMerge([
                [1, 3],
                [8, 10],
                [2, 6],
                [10, 16],
            ]),
        ).toEqual([
            [1, 6],
            [8, 16],
        ]);
        expect(
            solveMerge([
                [7, 13],
                [13, 19],
                [18, 24],
            ]),
        ).toEqual([[7, 24]]);
    });

    test('Proper 2 Coloring', () => {
        expect(
            solveColor([
                4,
                [
                    [0, 2],
                    [0, 3],
                    [1, 2],
                    [1, 3],
                ],
            ]),
        ).toEqual([0, 0, 1, 1]);
        expect(
            solveColor([
                3,
                [
                    [0, 1],
                    [0, 2],
                    [1, 2],
                ],
            ]),
        ).toEqual([]);
        expect(
            solveColor([
                7,
                [
                    [2, 4],
                    [1, 5],
                    [0, 4],
                    [0, 6],
                    [0, 5],
                ],
            ]),
        ).toEqual([0, 0, 0, 0, 1, 1, 1]);
    });

    test('Sanitize Parentheses', () => {
        expect(new Set(solveParens('()())()'))).toEqual(
            new Set(['(())()', '()()()']),
        );
        expect(new Set(solveParens('(a)())()'))).toEqual(
            new Set(['(a())()', '(a)()()']),
        );
        expect(solveParens(')(')).toEqual(['']);
        expect(solveParens('((())((a')).toEqual(['(())a']);
    });
});
