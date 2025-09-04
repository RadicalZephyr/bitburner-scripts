import { describe, expect, test } from '@jest/globals';

import {
    isArrayUnknown,
    isBigInt,
    isBoolean,
    isNull,
    isNumber,
    isObjectUnknown,
    isString,
    isUndefined,
    isArrayOf,
    isObjectLike,
} from '../validate';

describe('Validator functions', () => {
    describe('core JS type validator functions are provided', () => {
        test.each([
            ['undefined', isUndefined, undefined, null],
            ['null', isNull, null, undefined],
            ['boolean', isBoolean, false, null],
            ['number', isNumber, 0, 'hello'],
            ['bigint', isBigInt, 0n, undefined],
            ['string', isString, '', 3],
            ['array of unknown', isArrayUnknown, [], null],
            ['array of T', isArrayOf(isNumber), [0, 1, 2], ['', 2, null]],
            ['object', isObjectUnknown, {}, null],
        ])('%s validator', (type, validate, valid, invalid) => {
            expect(validate(valid)).toBeTruthy();
            expect(validate(invalid)).toBeFalsy();
        });
    });

    describe('isObjectUnknown', () => {
        test.each([
            ['empty', {}],
            ['non-empty', { has: 'a-key' }],
        ])('validates %s object ', (description, value) => {
            expect(isObjectUnknown(value)).toBeTruthy();
        });

        test('undefined is not an object', () => {
            expect(isObjectUnknown(undefined)).toBeFalsy();
        });

        test.each([null, 0, 0n, '', []])('%s is not an object', (value) => {
            expect(isObjectUnknown(value)).toBeFalsy();
        });
    });

    describe('compound objects can be validated by spec', () => {
        const isTestObject = isObjectLike({
            bool: isBoolean,
            num: isNumber,
            str: isString,
            bi: isBigInt,
            arr: isArrayOf(isString),
        });

        const baseObject = { bool: false, num: 0, str: '', bi: 0n, arr: [] };
        test('with all keys present', () => {
            expect(isTestObject(baseObject)).toBeTruthy();
        });

        for (const k of Object.keys(baseObject)) {
            const missingK = { ...baseObject };
            delete missingK[k];

            test(`missing ${k}`, () => {
                expect(isTestObject(missingK)).toBeFalsy();
            });
        }

        describe("non-objects don't validate", () => {
            test.each([null, 0, 1n, 'string', true, []])('%s', (notObj) => {
                expect(isTestObject(notObj)).toBeFalsy();
            });
        });
    });
});
