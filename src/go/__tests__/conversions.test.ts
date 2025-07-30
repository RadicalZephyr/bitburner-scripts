import { describe, expect, test } from '@jest/globals';

import { isMoveResponse, toIndices, toVertex } from 'go/types';

describe('vertex/index conversions', () => {
    test('converts basic vertices to indices and back', () => {
        expect(toIndices('a1')).toEqual([0, 0]);
        expect(toVertex(0, 0)).toBe('a1');

        expect(toIndices('c6')).toEqual([2, 5]);
        expect(toVertex(2, 5)).toBe('c6');

        expect(toIndices('t19')).toEqual([18, 18]);
        expect(toVertex(18, 18)).toBe('t19');
    });
});

describe('type predicates', () => {
    test('isMoveResponse handles pass, resign and vertex responses', () => {
        expect(isMoveResponse('pass')).toBeTruthy();
        expect(isMoveResponse('resign')).toBeTruthy();
        expect(isMoveResponse('a1')).toBeTruthy();
        expect(isMoveResponse('t19')).toBeTruthy();
    });
});
