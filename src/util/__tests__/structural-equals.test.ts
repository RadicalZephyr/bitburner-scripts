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

    describe('arrays compare element wise', () => {
        test('numeric arrays with same elements are equal', () => {
            expect(isStructuralEqual([1, 2, 3], [1, 2, 3])).toBeTruthy();
        });

        test('numeric arrays with same array elements are equal', () => {
            expect(
                isStructuralEqual([[1], [2], [3]], [[1], [2], [3]]),
            ).toBeTruthy();
        });

        test("numeric arrays with different elements aren't equal", () => {
            expect(isStructuralEqual([1, 2, 3], [4, 5, 6])).toBeFalsy();
        });

        test("numeric arrays with same elements in a different order aren't equal", () => {
            expect(isStructuralEqual([1, 2, 3], [2, 1, 3])).toBeFalsy();
        });
    });
});
