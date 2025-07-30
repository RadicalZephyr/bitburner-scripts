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
