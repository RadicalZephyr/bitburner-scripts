import { describe, expect, test } from '@jest/globals';

import { solve as solveExpr } from '../Find-All-Valid-Math-Expressions';

type TestCase = [Parameters<typeof solveExpr>[0], ReturnType<typeof solveExpr>];

describe('Math Expressions', () => {
    test.each([
        [
            ['123', 6],
            ['1+2+3', '1*2*3'],
        ],
        [
            ['105', 5],
            ['1*0+5', '10-5'],
        ],
        [['29787', -8], ['2-97+87']],
    ] satisfies TestCase[])(
        '%s',
        (data: [string, number], expected: string[]) => {
            expect(new Set(solveExpr(data))).toEqual(new Set(expected));
        },
    );
});
