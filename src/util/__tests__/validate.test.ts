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
    makeIsArray,
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
            ['array of T', makeIsArray(isNumber), [0, 1, 2], ['', 2, null]],
            ['object', isObjectUnknown, {}, null],
        ])('%s validator', (type, validate, valid, invalid) => {
            expect(validate(valid)).toBeTruthy();
            expect(validate(invalid)).toBeFalsy();
        });
    });
});
