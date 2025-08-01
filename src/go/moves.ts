import { IdxVertex, Node, isNode } from 'go/types';

/**
 * Choose one of the empty points near to the invalid move the AI
 * wants to play.
 *
 * @param validMoves - 2d array indicating whether each vertex is a valid move
 * @param [x, y] - invalid move index coordinates
 * @returns Returns a valid move within +/-2 of x and y, or [-1, -1] if none exist.
 */
export function randomNearInvalidMove(
    validMoves: boolean[][],
    [x, y]: [number, number],
): [number, number] {
    const moveOptions = [];
    for (let i = x - 2; i <= x + 2; i++) {
        if (i < 0 || i >= validMoves.length) continue;
        for (let j = y - 2; j <= y + 2; j++) {
            if (j < 0 || j >= validMoves[i].length) continue;
            if (validMoves[i][j]) {
                moveOptions.push([i, j]);
            }
        }
    }
    // Choose one of the found moves at random
    const randomIndex = Math.floor(Math.random() * moveOptions.length);
    return moveOptions[randomIndex] ?? [-1, -1];
}

/**
 * Choose one of the empty points on the board at random to play.
 *
 * @param board      - Board representation
 * @param validMoves - 2d array indicating whether each vertex is a valid move
 * @returns Returns a valid move somewhere on the board
 */
export function getRandomMove(board: string[], validMoves: boolean[][]) {
    const moveOptions = [];
    const size = board[0].length;

    // Look through all the points on the board
    for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
            // Make sure the point is a valid move
            const isValidMove = validMoves[x][y] === true;
            // Leave some spaces to make it harder to capture our pieces.
            // We don't want to run out of empty node connections!
            const isNotReservedSpace = x % 2 === 1 || y % 2 === 1;

            if (isValidMove && isNotReservedSpace) {
                moveOptions.push([x, y]);
            }
        }
    }

    // Choose one of the found moves at random
    const randomIndex = Math.floor(Math.random() * moveOptions.length);
    return moveOptions[randomIndex] ?? [-1, -1];
}

/**
 * Get the node type at the given vertex.
 *
 * @param board - Board to retrieve vertex from
 * @param [x, y] - Index vertex to get node of
 * @returns Node value at the given vertex
 */
export function nodeAt(board: string[], [x, y]: IdxVertex): Node | null {
    if (x < 0 || x >= board.length || y < 0 || y >= board[0].length)
        return null;

    const node = board[x][y];
    if (!isNode(node)) return null;

    return node;
}

/**
 * List of valid neighbor IdxVertex of the given vertex.
 *
 * @param board  - Board to check neighbors for
 * @param [x, y] - index vertex to get valid neighbors of
 * @returns A list of IdxVertex that are valid neighbor vertices of the given vertex
 */
export function neighbors(board: string[], [x, y]: IdxVertex): IdxVertex[] {
    const colLow = 0;
    const colHigh = board.length - 1;
    const rowLow = 0;
    const rowHigh = board[0].length - 1;

    const neighborDeltas = [
        [-1, 0],
        [0, -1],
        [1, 0],
        [0, 1],
    ];

    const validNeighbors = [];
    for (const [dX, dY] of neighborDeltas) {
        const nX = x + dX;
        const nY = y + dY;
        if (nX < colLow || nX > colHigh || nY < rowLow || nY > rowHigh)
            continue;
        validNeighbors.push([nX, nY]);
    }
    return validNeighbors;
}

type ConnectedComponents = number[][];

export interface Component {
    node: Node;
    vertices: Set<IdxVertex>;
}

/**
 * Find all connected components on the board.
 *
 * @param board
 */
export function connectedComponents(board: string[]): ConnectedComponents {
    function findComponents(components: ConnectedComponents, label: number) {
        for (let x = 0; x < components.length; x++) {
            for (let y = 0; y < components[0].length; y++) {
                if (components[x][y] === -1) {
                    label += 1;
                    search(components, label, x, y);
                }
            }
        }
    }

    function search(
        components: ConnectedComponents,
        label: number,
        x: number,
        y: number,
    ) {
        components[x][y] = label;
        const ns = ccNeighbors(components, [x, y]);
        for (const [nX, nY] of ns) {
            if (components[nX][nY] === -1 && board[x][y] === board[nX][nY]) {
                search(components, label, nX, nY);
            }
        }
    }

    function ccNeighbors(
        components: ConnectedComponents,
        [x, y]: IdxVertex,
    ): IdxVertex[] {
        const colLow = 0;
        const colHigh = components.length - 1;
        const rowLow = 0;
        const rowHigh = components[0].length - 1;

        const neighborDeltas = [
            [0, -1],
            [-1, 0],
            [1, 0],
            [0, 1],
        ];

        const validNeighbors = [];
        for (const [dX, dY] of neighborDeltas) {
            const nX = x + dX;
            const nY = y + dY;
            if (nX < colLow || nX > colHigh || nY < rowLow || nY > rowHigh)
                continue;
            validNeighbors.push([nX, nY]);
        }
        return validNeighbors;
    }

    function negate(components: ConnectedComponents) {
        for (let x = 0; x < components.length; x++) {
            for (let y = 0; y < components.length; y++) {
                if (board[x][y] !== '.') components[x][y] = -1; // thing
            }
        }
    }

    const components: number[][] = Array(board.length)
        .fill([])
        .map(() => Array(board[0].length).fill(0));
    negate(components);

    const label = 0;
    findComponents(components, label);

    return components;
}
