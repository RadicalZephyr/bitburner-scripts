export const COL_NAMES = [
    'a',
    'b',
    'c',
    'd',
    'e',
    'f',
    'g',
    'h',
    'j',
    'k',
    'l',
    'm',
    'n',
    'o',
    'p',
    'q',
    'r',
    's',
    't',
];
export const ROW_NAMES = [
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    12,
    13,
    14,
    15,
    16,
    17,
    18,
    19,
];
export const NODES = ['.', 'O', 'X', '#'];
export const Node = {
    EMPTY: '.',
    WHITE: 'O',
    BLACK: 'X',
    DISABLED: '#',
};
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
export function filterMapBoard(board, callbackFn) {
    const result = [];
    for (let i = 0; i < board.length && i < COL_NAMES.length; i++) {
        const col = COL_NAMES[i];
        const column = board[i].split('');
        for (let j = 0; j < column.length && j < ROW_NAMES.length; j++) {
            const node = column[j];
            const row = ROW_NAMES[j];
            const vertex = `${col}${row}`;
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
export function isVertex(s) {
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
export function isMove(s) {
    if (s === 'pass' || s === 'resign')
        return true;
    return isVertex(s);
}
/**
 * Convert a GTP vertex to a 0-based multidimensional board array index.
 *
 * @param vertex - Vertex to convert
 * @returns x and y indices
 */
export function toIndices(vertex) {
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
export function toVertex(x, y) {
    if (x >= COL_NAMES.length)
        throw new Error(`tried to generate vertex with invalid col index ${x}`);
    if (y >= ROW_NAMES.length)
        throw new Error(`tried to generate vertex with invalid row index ${y}`);
    const col = COL_NAMES[x];
    const row = ROW_NAMES[y];
    return `${col}${row}`;
}
const VERTEX_RE = /^([a-hj-t])(\d+)$/;
/**
 * Translate a Vertex string to the corresponding column index.
 *
 * @param s - Vertex string
 * @returns zero based column index
 */
export function columnIndex(s) {
    const match = s.match(VERTEX_RE);
    if (!match)
        return -1;
    const col = match[1];
    return COL_NAMES.findIndex((colName) => colName === col);
}
/**
 * Translate a Vertex string to the correpsonding row index.
 *
 * @param s - Vertex string
 * @returns zero based row index
 */
export function rowIndex(s) {
    const match = s.match(VERTEX_RE);
    if (!match)
        return -1;
    const row = Number.parseInt(match[2], 10);
    return ROW_NAMES.findIndex((rowName) => rowName === row);
}
