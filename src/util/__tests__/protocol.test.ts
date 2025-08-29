import { describe, expect, test } from '@jest/globals';

import { type ProtocolDef, type Validator } from '../protocol';

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
