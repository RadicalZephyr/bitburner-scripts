import { expect, test } from '@jest/globals';

import { solve as solveAST4 } from '../Algorithmic-Stock-Trader-IV';

test('Algorithmic Stock Trader IV', () => {
    expect(
        solveAST4([
            10,
            [
                5, 90, 66, 133, 66, 57, 137, 159, 102, 30, 109, 193, 125, 151,
                40, 32, 22, 79, 200, 32, 141, 91, 187, 164, 113, 1, 175, 133,
                32, 123, 59, 95, 103, 115, 135, 171, 152, 95, 69, 74, 176, 152,
                181, 39, 48, 159, 145, 17, 168, 38,
            ],
        ]),
    ).toBe(1422);
});
