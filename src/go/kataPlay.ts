import type { NS } from 'netscript';

import { GtpClient, toIndices, toVertex } from 'go/GtpClient';
import { filterMapBoard, Move, Node, Vertex } from 'go/types';

export async function main(ns: NS) {
    const client = new GtpClient(ns);

    await setupExistingGame(ns, client);
    await playGame(ns, client);
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

        const [x, y] = toIndices(myMove);
        const isPassMove = x === -1 && y === -1;

        if (!(isPassMove || validMoves[x][y]))
            throw new Error(
                `tried to play invalid move ${myMove} (${x}, ${y})`,
            );

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
