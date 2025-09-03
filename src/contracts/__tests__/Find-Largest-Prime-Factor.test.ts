import { expect, test } from '@jest/globals';

import { solve as solvePrime } from '../Find-Largest-Prime-Factor';

test('Largest Prime Factor', () => {
    expect(solvePrime(129983129)).toBe(23629);
});
