import { describe, expect, test } from '@jest/globals';

import {
    isArrayUnknown,
    isBigInt,
    isBoolean,
    isRequestUnknown,
    isNull,
    isNumber,
    isObjectUnknown,
    isResponseUnknown,
    isString,
    isUndefined,
    makeIsArray,
    type ProtocolDef,
    type Validator,
    defineProtocol,
} from '../protocol';

describe('our protocol abstraction', () => {
    test('is based on Validator functions', () => {
        const isValid = ((o: unknown): o is object => {
            return typeof o === 'object' && o !== null;
        }) satisfies Validator<object>;

        expect(isValid({})).toBeTruthy();

        expect(isValid(undefined)).toBeFalsy();
        expect(isValid(null)).toBeFalsy();
        expect(isValid(1)).toBeFalsy();
        expect(isValid(1n)).toBeFalsy();
        expect(isValid('thing')).toBeFalsy();
    });

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

describe('protocol definitions map a message type', () => {
    test('to a payload', () => {
        const testProtoType = 'foo';
        const TestProtoDef = {
            [testProtoType]: {
                payload: (v: unknown): v is number => typeof v === 'number',
            },
        } as const satisfies ProtocolDef;

        const validate = TestProtoDef[testProtoType].payload;
        expect(validate(1)).toBeTruthy();
        expect(validate('')).toBeFalsy();
    });

    test('and an optional response', () => {
        const testProtoType = 'foo';
        const TestProtoDef = {
            [testProtoType]: {
                payload: (v: unknown): v is number => typeof v === 'number',
                response: (v: unknown): v is string => typeof v === 'string',
            },
        } as const satisfies ProtocolDef; // todo

        const validate = TestProtoDef[testProtoType].response;
        expect(validate('')).toBeTruthy();
        expect(validate(1)).toBeFalsy();
    });
});

describe('all protocols use common envelopes', () => {
    describe('requests', () => {
        test.each([
            ['with message id', { type: 'foo', id: '', payload: {} }],
            ['with missing message id', { type: 'bar', payload: [] }],
            ['with null message id', { type: 'bar', id: null, payload: [] }],
            [
                'with explicitly undefined message id',
                { type: 'bar', id: undefined, payload: [] },
            ],
        ])('%s are valid', (description, message) => {
            expect(isRequestUnknown(message)).toBeTruthy();
        });

        test.each([
            ['with no type', { id: '', payload: 1 }],
            ['with no payload', { type: 'foo', id: '' }],
        ])('%s are invalid', (description, message) => {
            expect(isRequestUnknown(message)).toBeFalsy();
        });
    });

    describe('responses', () => {
        test('with type, id and payload are valid', () => {
            const response = { type: 'foo', id: '', payload: {} };
            expect(isResponseUnknown(response)).toBeTruthy();
        });

        test.each([
            ['with no type', { id: '', payload: 1 }],
            ['with no id', { type: 'bar', payload: 0n }],
            ['with no payload', { type: 'foo', id: '' }],
        ])('%s are invalid', (description, response) => {
            expect(isResponseUnknown(response)).toBeFalsy();
        });
    });
});

describe('custom protocols create precise request validators', () => {
    const TestProtocol = defineProtocol({
        withNoResponse: {
            payload: isString,
        },

        withResponse: {
            payload: isString,
            response: isBoolean,
        },
    });

    describe('type with no response validator', () => {
        test('is valid with no id', () => {
            expect(
                TestProtocol.isRequest({
                    type: 'withNoResponse',
                    payload: 'hello protocol',
                }),
            ).toBeTruthy();
        });

        test.each([
            ['null', null],
            ['undefined', undefined],
        ])('is valid with %s id', (description, id) => {
            expect(
                TestProtocol.isRequest({
                    type: 'withNoResponse',
                    id,
                    payload: 'hello protocol',
                }),
            ).toBeTruthy();
        });

        test('is invalid with a string id', () => {
            expect(
                TestProtocol.isRequest({
                    type: 'withNoResponse',
                    id: '',
                    payload: 'hello protocol',
                }),
            ).toBeFalsy();
        });
    });

    describe('type with a response validator', () => {
        test('is invalid with no id', () => {
            expect(
                TestProtocol.isRequest({
                    type: 'withResponse',
                    payload: 'hello response',
                }),
            ).toBeFalsy();
        });

        test.each([
            ['null', null],
            ['undefined', undefined],
        ])('is invalid with %s id', (description, id) => {
            expect(
                TestProtocol.isRequest({
                    type: 'withResponse',
                    id,
                    payload: 'hello response',
                }),
            ).toBeFalsy();
        });

        test('is valid with a string id', () => {
            expect(
                TestProtocol.isRequest({
                    type: 'withResponse',
                    id: '',
                    payload: 'hello response',
                }),
            ).toBeTruthy();
        });
    });
});
