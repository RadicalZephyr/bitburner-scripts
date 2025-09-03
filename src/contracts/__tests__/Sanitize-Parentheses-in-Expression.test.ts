import { describe, expect, test } from '@jest/globals';

import { solve as solveParens } from '../Sanitize-Parentheses-in-Expression';

describe('Sanitize Parentheses', () => {
    test.each([
        ['()())()', ['(())()', '()()()']],
        ['(a)())()', ['(a())()', '(a)()()']],
        [')(', ['']],
        ['((())((a', ['(())a']],
    ])('%s', (data, expected) => {
        expect(new Set(solveParens(data))).toEqual(new Set(expected));
    });
});
