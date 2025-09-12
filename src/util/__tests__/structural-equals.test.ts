import { describe, test, expect } from '@jest/globals';

import { isStructuralEqual } from '../structural-equals';

describe('isStructuralEqual', () => {
    describe('primitive values compare with ===', () => {
        describe('primitives compare equal to themselves', () => {
            test.each([undefined, null, false, true, 0, 1, 0n, 10n, '', 'abc'])(
                '%s === %s',
                (a: unknown) => {
                    expect(isStructuralEqual(a, a)).toBeTruthy();
                },
            );
        });

        describe("primitives don't coerce during comparison", () => {
            test.each([
                [0, '0'],
                [0n, 0],
                [0n, new String('0')],
                [7, '7'],
            ])('%s !== %s', (a, b) => {
                expect(isStructuralEqual(a, b)).toBeFalsy();
                expect(isStructuralEqual(b, a)).toBeFalsy();
            });
        });
    });
});
