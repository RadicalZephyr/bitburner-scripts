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

export type Col = (typeof COL_NAMES)[number];

export type Row = (typeof ROW_NAMES)[number];

export type Vertex = `${Col}${Row}`;

export type IdxVertex = [number, number];

export type MoveResponse = 'pass' | 'resign' | Vertex;

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
 * Call a defined callback function on each element of the board and
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

/**
 * Type predicate for validating a string is a Vertex.
 *
 * @param s - candidate Vertex string
 * @returns Whether the candidate is a valid Vertex
 */
export function isVertex(s: string): s is Vertex {
    const x = columnIndex(s);
    const y = rowIndex(s);
    return x !== -1 && y !== -1;
}

/**
 * Type predicate for ResponseMoves.
 *
 * @param s - candidate ResponseMove string
 * @returns Whether  the candidate is a valid ResponseMove
 */
export function isMoveResponse(s: string): s is MoveResponse {
    if (s === 'pass' || s === 'resign') return true;
    return isVertex(s);
}

/**
 * Convert a GTP vertex to a 0-based multidimensional board array index.
 *
 * @param vertex - Vertex to convert
 * @returns x and y indices
 */
export function toIndices(vertex: Vertex): IdxVertex {
    const x = columnIndex(vertex);
    if (x === -1)
        throw new Error(`tried to transform invalid vertex ${vertex}`);

    const y = rowIndex(vertex);
    if (y === -1)
        throw new Error(`tried to transform invalid vertex ${vertex}`);

    return [x, y];
}

/**
 * Convert a 0-based multidimensional board array index to a GTP vertex.
 *
 * @param x - Column index
 * @param y - Row index
 * @returns Vertex corresponding to indices
 */
export function toVertex(x: number, y: number): Vertex {
    if (x >= COL_NAMES.length)
        throw new Error(`tried to generate vertex with invalid col index ${x}`);

    if (y >= ROW_NAMES.length)
        throw new Error(`tried to generate vertex with invalid row index ${y}`);

    const col = COL_NAMES[x];
    const row = ROW_NAMES[y];
    return `${col}${row}` as Vertex;
}

const VERTEX_RE = /^([a-hj-t])(\d+)$/;

/**
 * Translate a Vertex string to the corresponding column index.
 *
 * @param s - Vertex string
 * @returns zero based column index
 */
export function columnIndex(s: string): number {
    const match = s.match(VERTEX_RE);
    if (!match) return -1;
    const col = match[1];
    return COL_NAMES.findIndex((colName) => colName === col);
}

/**
 * Translate a Vertex string to the correpsonding row index.
 *
 * @param s - Vertex string
 * @returns zero based row index
 */
export function rowIndex(s: string): number {
    const match = s.match(VERTEX_RE);
    if (!match) return -1;
    const row = Number.parseInt(match[2], 10);
    return ROW_NAMES.findIndex((rowName) => rowName === row);
}
