import { describe, expect, test } from '@jest/globals';

import { setLocalStorage } from 'util/localStorage';

let toIndices: typeof import('go/GtpClient').toIndices;
let toVertex: typeof import('go/GtpClient').toVertex;

describe('vertex/index conversions', () => {
    beforeAll(async () => {
        const store: Record<string, string> = {};
        const ls: Storage = {
            get length() {
                return Object.keys(store).length;
            },
            clear: () => {
                for (const k in store) delete store[k];
            },
            key: (i) => Object.keys(store)[i],
            getItem: (k) => store[k],
            removeItem: (k) => {
                delete store[k];
            },
            setItem: (k, v) => {
                store[k] = v;
            },
        };
        setLocalStorage(ls);
        const mod = await import('go/GtpClient');
        toIndices = mod.toIndices;
        toVertex = mod.toVertex;
    });

    test('converts basic vertices to indices and back', () => {
        expect(toIndices('a1')).toEqual([0, 0]);
        expect(toVertex(0, 0)).toBe('a1');

        expect(toIndices('c6')).toEqual([2, 5]);
        expect(toVertex(2, 5)).toBe('c6');

        expect(toIndices('t19')).toEqual([18, 18]);
        expect(toVertex(18, 18)).toBe('t19');
    });

    test('handles pass vertex', () => {
        expect(toIndices('pass')).toEqual([-1, -1]);
    });
});
