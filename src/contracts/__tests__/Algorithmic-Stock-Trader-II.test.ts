import { expect, test } from '@jest/globals';

import { solve as solveAST2 } from '../Algorithmic-Stock-Trader-II';

test('Algorithmic Stock Trader II', () => {
    expect(
        solveAST2([
            127, 191, 145, 88, 127, 1, 145, 13, 19, 13, 195, 75, 198, 47, 149,
            8,
        ]),
    ).toBe(660);
});
