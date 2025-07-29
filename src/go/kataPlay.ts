import type { NS } from 'netscript';

import { GtpClient, toIndices, toVertex } from 'go/GtpClient';
import { filterMapBoard, Move, Node, Vertex } from 'go/types';

export async function main(ns: NS) {
    ns.disableLog('ALL');

    const client = new GtpClient(ns);

    while (true) {
        const gameState = ns.go.getGameState();

        if (gameState.currentPlayer === 'None') {
            ns.go.resetBoardState('Daedalus', 9);
        }
        await setupExistingGame(ns, client);
        await playGame(ns, client);
    }
}

async function setupExistingGame(ns: NS, client: GtpClient) {
    await client.clearBoard();

    const board = ns.go.getBoardState();
    await client.boardsize(board.length);

    const gameState = ns.go.getGameState();
    await client.komi(gameState.komi);

    const positions = filterMapBoard(board, vertexToMove);
    await client.setPosition(positions);
}

function vertexToMove(node: Node, vertex: Vertex): Move | null {
    switch (node) {
        case Node.BLACK: {
            return ['black', vertex];
        }
        case Node.DISABLED:
        case Node.WHITE: {
            return ['white', vertex];
        }
        case Node.EMPTY: {
            return null;
        }
    }
}

async function playGame(ns: NS, client: GtpClient) {
    while (true) {
        const validMoves = ns.go.analysis.getValidMoves();

        // Have the engine generate the next move
        const myMove = await client.genmove('black');

        let [x, y] = toIndices(myMove);
        const isPassMove = x === -1 && y === -1;

        if (!(isPassMove || validMoves[x][y])) {
            const [x1, y1] = randomNearInvalidMove(ns, [x, y]);
            if (x1 !== -1 && y1 !== -1) {
                x = x1;
                y = y1;
            } else {
                [x, y] = getRandomMove(ns);
            }
        }

        let opponentMove;
        if (isPassMove) {
            opponentMove = await ns.go.passTurn();
        } else {
            // Play the selected move
            opponentMove = await ns.go.makeMove(x, y);
        }

        switch (opponentMove.type) {
            case 'move': {
                await client.play(
                    'white',
                    toVertex(opponentMove.x, opponentMove.y),
                );
                break;
            }
            case 'pass': {
                // TODO: do we need to handle this in some other way?
                await ns.sleep(10);
                break;
            }
            case 'gameOver': {
                return;
            }
        }
    }
}

function randomNearInvalidMove(
    ns: NS,
    [x, y]: [number, number],
): [number, number] {
    const validMoves = ns.go.analysis.getValidMoves();
    const moveOptions = [];
    for (let i = x - 2; i <= x + 2; i++) {
        for (let j = y - 2; j <= y + 2; j++) {
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
 * Choose one of the empty points on the board at random to play
 */
function getRandomMove(ns: NS) {
    const board = ns.go.getBoardState();
    const validMoves = ns.go.analysis.getValidMoves();
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
    return moveOptions[randomIndex] ?? [];
}
