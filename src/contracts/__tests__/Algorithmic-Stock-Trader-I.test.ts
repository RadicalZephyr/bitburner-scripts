import { expect, test } from '@jest/globals';

import { solve as solveAST1 } from '../Algorithmic-Stock-Trader-I';

test('Algorithmic Stock Trader I', () => {
    expect(solveAST1([72, 148, 128, 33, 71, 9, 2, 163, 155, 107, 2, 98])).toBe(
        161,
    );
});
