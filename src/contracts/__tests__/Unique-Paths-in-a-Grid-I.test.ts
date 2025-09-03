import { expect, test } from '@jest/globals';

import { solve as solveGridI } from '../Unique-Paths-in-a-Grid-I';

test('Unique Paths Grid I', () => {
    expect(solveGridI([4, 6])).toBe(56);
});
