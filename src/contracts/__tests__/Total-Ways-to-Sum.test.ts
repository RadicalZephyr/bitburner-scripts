import { expect, test } from '@jest/globals';

import { solve as solveSum } from '../Total-Ways-to-Sum';

test('Total Ways to Sum', () => {
    expect(solveSum(93)).toBe(82010176);
});
