import { describe, test, expect } from '@jest/globals';

import {
    isArrayStructuralEqual,
    isMapStructuralEqual,
    isStructuralEqual,
} from '../structural-equals';

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
                [{}, null],
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

    describe('objects compare key-wise', () => {
        test('empty objects are equal', () => {
            expect(isStructuralEqual({}, {})).toBeTruthy();
        });

        test('objects with one key are equal', () => {
            expect(isStructuralEqual({ a: 1 }, { a: 1 })).toBeTruthy();
        });

        test('objects with recursive objects all with same keys are equal', () => {
            expect(
                isStructuralEqual(
                    { c: { a: 1, b: ['foo'] } },
                    { c: { a: 1, b: ['foo'] } },
                ),
            ).toBeTruthy();
        });

        test('objects with same keys and different values are not equal', () => {
            expect(isStructuralEqual({ a: 1 }, { a: 'foo' })).toBeFalsy();
        });

        test('objects with different keys are not equal', () => {
            expect(isStructuralEqual({ a: 1 }, { b: 1 })).toBeFalsy();
        });
    });

    describe('Maps compare key-wise', () => {
        test('empty maps are equal', () => {
            expect(isStructuralEqual(new Map(), new Map())).toBeTruthy();
        });

        test('maps with the same key-value mappings are equal', () => {
            const a = new Map([
                ['a', 1],
                ['c', 7],
            ]);
            const b = new Map([
                ['a', 1],
                ['c', 7],
            ]);
            expect(isStructuralEqual(a, b)).toBeTruthy();
        });

        test('maps with the different keys are not equal', () => {
            const a = new Map([['a', 1]]);
            const b = new Map([
                ['a', 5],
                ['c', 2],
            ]);
            expect(isStructuralEqual(a, b)).toBeFalsy();
        });

        test('maps with the same keys but different values are not equal', () => {
            const a = new Map([
                ['a', 1],
                ['c', 7],
            ]);
            const b = new Map([
                ['a', 5],
                ['c', 2],
            ]);
            expect(isStructuralEqual(a, b)).toBeFalsy();
        });
    });
});

describe('isArrayStructuralEqual', () => {
    test('arrays compare element wise', () => {
        expect(isArrayStructuralEqual([1, 2], [1, 2])).toBeTruthy();
        expect(isArrayStructuralEqual([1, 2], [2, 1])).toBeFalsy();
    });
});

describe('isMapEqual', () => {
    test('maps with all the same key-value mappings are equal', () => {
        const a = new Map([
            ['a', 1],
            ['c', 7],
        ]);
        const b = new Map([
            ['a', 1],
            ['c', 7],
        ]);
        expect(isMapStructuralEqual(a, b)).toBeTruthy();
    });

    test('maps of different numbers of keys are not equal', () => {
        const a = new Map([
            ['a', 1],
            ['c', 7],
        ]);
        const b = new Map([['a', 1]]);
        expect(isMapStructuralEqual(a, b)).toBeFalsy();
    });

    test('maps with the same keys but different values are not equal', () => {
        const a = new Map([
            ['a', 3],
            ['c', 4],
        ]);
        const b = new Map([
            ['a', 1],
            ['c', 7],
        ]);
        expect(isMapStructuralEqual(a, b)).toBeFalsy();
    });
});
