import { describe, expect, test } from '@jest/globals';

import { neighbors } from 'go/moves';

describe('neighbors', () => {
    test('all neighbors valid', () => {
        const board = ['...', '.X.', '...'];
        expect(neighbors(board, [1, 1])).toStrictEqual([
            [0, 1],
            [1, 0],
            [2, 1],
            [1, 2],
        ]);
    });

    test('off the edge neighbors not included', () => {
        const board = ['X..', '...', '..O'];
        expect(neighbors(board, [0, 0])).toStrictEqual([
            [1, 0],
            [0, 1],
        ]);

        expect(neighbors(board, [0, 2])).toStrictEqual([
            [0, 1],
            [1, 2],
        ]);

        expect(neighbors(board, [2, 0])).toStrictEqual([
            [1, 0],
            [2, 1],
        ]);

        expect(neighbors(board, [2, 2])).toStrictEqual([
            [1, 2],
            [2, 1],
        ]);
    });
});
