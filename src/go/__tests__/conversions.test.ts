import { describe, expect, test } from '@jest/globals';

import {
    COL_NAMES,
    ROW_NAMES,
    isMoveResponse,
    isVertex,
    toIndices,
    toVertex,
} from 'go/types';

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

    const vertices = [];
    for (const row of ROW_NAMES) {
        for (const col of COL_NAMES) {
            vertices.push(`${col}${row}`);
        }
    }

    test.each(vertices)('isVertex handles valid vertex: %s', (v) => {
        expect(isVertex(v)).toBeTruthy();
    });

    const iBadVertices = [];
    for (const row of ROW_NAMES) {
        iBadVertices.push(`i${row}`);
    }
    test.each(iBadVertices)('isVertex rejects column name "I"', (badV) => {
        expect(isVertex(badV)).toBeFalsy();
    });

    test('arbitrary strings are not Vertices', () => {
        expect(isVertex('aoeu')).toBeFalsy();
        expect(isVertex('pass')).toBeFalsy();
        expect(isVertex('resign')).toBeFalsy();
    });

    test('zero index rows are not Vertices', () => {
        expect(isVertex('a0')).toBeFalsy();
        expect(isVertex('e0')).toBeFalsy();
        expect(isVertex('t0')).toBeFalsy();
    });
});
