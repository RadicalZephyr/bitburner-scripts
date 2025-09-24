import { expect, test } from '@jest/globals';

import { solve as solveAST3 } from '../Algorithmic-Stock-Trader-III';

test('Algorithmic Stock Trader III', () => {
    expect(
        solveAST3([
            36, 84, 162, 118, 111, 59, 199, 106, 23, 49, 121, 77, 188, 5, 191,
            139, 69, 104, 186, 78, 73, 87, 97, 193, 193, 73, 68, 5, 196, 169,
            116, 82, 180, 1, 107, 123, 111, 51, 184, 89, 101, 3, 140, 109, 85,
        ]),
    ).toBe(379);
});
