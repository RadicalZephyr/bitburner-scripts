import { describe, expect, test } from '@jest/globals';

import {
    isUnionOf,
    isArrayOf,
    isArrayUnknown,
    isBigInt,
    isBoolean,
    isLiteral,
    isNull,
    isNumber,
    isObjectLike,
    isObjectUnknown,
    isOptional,
    isRecordOf,
    isString,
    isUndefined,
    isDefined,
    isAny,
    isTuple,
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

    describe('isAny', () => {
        test('undefined is valid', () => {
            expect(isAny(undefined)).toBeTruthy();
        });

        test.each([null, false, 0, 0n, '', [], {}])('%s is valid', (value) => {
            expect(isAny(value)).toBeTruthy();
        });
    });

    describe('isDefined', () => {
        test('undefined is not valid', () => {
            expect(isDefined(undefined)).toBeFalsy();
        });

        test.each([null, false, 0, 0n, '', [], {}])('%s', (value) => {
            expect(isDefined(value)).toBeTruthy();
        });
    });

    describe('isLiteral', () => {
        const isThing = isLiteral('thing');

        test('thing string', () => {
            expect(isThing('thing')).toBeTruthy();
            expect(isThing('')).toBeFalsy();
        });

        const isZero = isLiteral(0);

        test('zero', () => {
            expect(isZero(0)).toBeTruthy();
            expect(isZero(1)).toBeFalsy();
        });
    });

    describe('isOptional', () => {
        const isOptNumber = isOptional(isNumber);

        test.each([null, 0, 1, 100])('allows null or numbers: %s', (value) => {
            expect(isOptNumber(value)).toBeTruthy();
        });

        test.each(['', true, [], {}])('other values are invalid', (value) => {
            expect(isOptNumber(value)).toBeFalsy();
        });
    });

    describe('isAnyOf allows multiple different types', () => {
        const isAnyNumber = isUnionOf(isNumber, isBigInt);
        test.each([0n, 0])('%s is valid', (value) => {
            expect(isAnyNumber(value)).toBeTruthy();
        });

        test.each([null, false, 'string', [], {}])(
            '%s is not valid',
            (value) => {
                expect(isAnyNumber(value)).toBeFalsy();
            },
        );
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

    describe('isTuple', () => {
        const isNumString = isTuple(isNumber, isString);

        test('falsy values of types are valid', () => {
            expect(isNumString([0, ''])).toBeTruthy();
        });

        test('other values of types are valid', () => {
            expect(isNumString([700, 'helloworld'])).toBeTruthy();
        });

        test('reversed values of types are invalid', () => {
            expect(isNumString(['helloworld', 700])).toBeFalsy();
        });

        test('extra values of any type are invalid', () => {
            expect(isNumString([700, 'helloworld', null])).toBeFalsy();
        });
    });

    describe('isRecord', () => {
        const isNumRecord = isRecordOf(isNumber);

        test('empty object is valid', () => {
            expect(isNumRecord({})).toBeTruthy();
        });

        test('objects with number values are valid', () => {
            expect(isNumRecord({ anyKey: 0 })).toBeTruthy();
        });

        test('objects with other values are invalid', () => {
            expect(isNumRecord({ anyKey: 'bad' })).toBeFalsy();
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

    describe('objects with optional fields', () => {
        const isOptions = isObjectLike({
            threads: isOptional(isNumber),
        });

        test('missing optional field is valid', () => {
            expect(isOptions({})).toBeTruthy();
        });

        test('undefined optional field is valid', () => {
            expect(isOptions({ threads: undefined })).toBeTruthy();
        });

        test('null optional field is valid', () => {
            expect(isOptions({ threads: null })).toBeTruthy();
        });

        test('present optional field is valid', () => {
            expect(isOptions({ threads: 0 })).toBeTruthy();
        });
    });
});
