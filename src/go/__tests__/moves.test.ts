import { describe, expect, test } from '@jest/globals';

import { connectedComponents, neighbors, nodeAt } from 'go/moves';
import { Node } from 'go/types';

describe('nodeAt', () => {
    const board = ['.#.', 'XXX', 'OOO'];

    test('thing', () => {
        expect(nodeAt(board, [0, 0])).toBe(Node.EMPTY);
        expect(nodeAt(board, [0, 1])).toBe(Node.DISABLED);
        expect(nodeAt(board, [1, 1])).toBe(Node.BLACK);
        expect(nodeAt(board, [2, 1])).toBe(Node.WHITE);
    });

    test('invalid indices return null', () => {
        expect(nodeAt(board, [-1, 0])).toBeNull();
        expect(nodeAt(board, [-2, -2])).toBeNull();
        expect(nodeAt(board, [3, 1])).toBeNull();
        expect(nodeAt(board, [1, 3])).toBeNull();
        expect(nodeAt(board, [5, 5])).toBeNull();
    });
});

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

describe('connected components', () => {
    test('simple row components', () => {
        expect(connectedComponents(['###', '...', 'XXX'])).toStrictEqual([
            [1, 1, 1],
            [0, 0, 0],
            [2, 2, 2],
        ]);
    });

    test('simple column components', () => {
        expect(connectedComponents(['X.O', 'X.O', 'X.O'])).toStrictEqual([
            [1, 0, 2],
            [1, 0, 2],
            [1, 0, 2],
        ]);
    });

    test('complex component', () => {
        expect(connectedComponents(['X.O', 'XXX', 'O.X'])).toStrictEqual([
            [1, 0, 2],
            [1, 1, 1],
            [3, 0, 1],
        ]);
    });

    test('multiple complex components', () => {
        expect(
            connectedComponents(['#X.O', 'OXXX', 'O..X', 'OOOX']),
        ).toStrictEqual([
            [1, 2, 0, 3],
            [4, 2, 2, 2],
            [4, 0, 0, 2],
            [4, 4, 4, 2],
        ]);
    });
});
