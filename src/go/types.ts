export const COL_NAMES = [
    'a' as const,
    'b' as const,
    'c' as const,
    'd' as const,
    'e' as const,
    'f' as const,
    'g' as const,
    'h' as const,
    'j' as const,
    'k' as const,
    'l' as const,
    'm' as const,
    'n' as const,
    'o' as const,
    'p' as const,
    'q' as const,
    'r' as const,
    's' as const,
    't' as const,
];

export type Col = (typeof COL_NAMES)[number];

export const ROW_NAMES = [
    1 as const,
    2 as const,
    3 as const,
    4 as const,
    5 as const,
    6 as const,
    7 as const,
    8 as const,
    9 as const,
    10 as const,
    11 as const,
    12 as const,
    13 as const,
    14 as const,
    15 as const,
    16 as const,
    17 as const,
    18 as const,
    19 as const,
];

export type Row = (typeof ROW_NAMES)[number];

export type Vertex = 'pass' | 'resign' | `${Col}${Row}`;

export type Color = 'white' | 'w' | 'W' | 'black' | 'b' | 'B';

export type Move = [Color, Vertex];

export const NODES = ['.' as const, 'O' as const, 'X' as const, '#' as const];

export const Node = {
    EMPTY: '.' as const,
    WHITE: 'O' as const,
    BLACK: 'X' as const,
    DISABLED: '#' as const,
} as const;

/**
 * Possible node types on the Go board state.
 *
 * '.' - empty
 * 'O' - white
 * 'X' - black
 * '#' - disabled
 */
export type Node = (typeof NODES)[number];

export type BoardCallbackFn<T> = (
    node: Node,
    vertex: Vertex,
    board: string[],
) => T;

/**
 * Combined filter and map operation.
 *
 * Call a defined callback funtion on each element of the board and
 * returns an array that contains the results. The returned array
 * contains only mapped values that are truthy.
 *
 * @param board - Board representation
 * @param callbackFn - A function that accepts up to three arguments. The map method calls the callbackfn function one time for each vertex in the board.
 * @returns Array of mapped values that are truthy.
 */
export function filterMapBoard<T>(
    board: string[],
    callbackFn: BoardCallbackFn<T>,
): T[] {
    const result = [];
    for (let i = 0; i < board.length && i < COL_NAMES.length; i++) {
        const col = COL_NAMES[i] satisfies Col;
        const column = board[i].split('');
        for (let j = 0; j < column.length && j < ROW_NAMES.length; j++) {
            const node = column[j] as Node;
            const row = ROW_NAMES[j] satisfies Row;
            const vertex = `${col}${row}` satisfies Vertex;
            const mapped = callbackFn(node, vertex, board);
            if (mapped) {
                result.push(mapped);
            }
        }
    }
    return result;
}
