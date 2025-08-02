import type { AutocompleteData, GoOpponent, NS } from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

import { GtpClient } from 'go/GtpClient';
import { randomNearInvalidMove, getRandomMove } from 'go/moves';
import {
    filterMapBoard,
    Move,
    Node,
    Vertex,
    toIndices,
    toVertex,
} from 'go/types';

import { CONFIG } from 'go/config';

const FLAGS = [['help', false]] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    ns.disableLog('ALL');

    if (flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

Play IPvGO games using a KataGo HTTP proxy.

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --help   Show this help message

CONFIGURATION
  GO_goOpponent  Default opponent to challenge
  GO_boardSize   Board size for new games
`);
        return;
    }

    const client = new GtpClient(ns);

    while (true) {
        const gameState = ns.go.getGameState();

        if (gameState.currentPlayer === 'None') {
            ns.go.resetBoardState(
                CONFIG.goOpponent as GoOpponent,
                CONFIG.boardSize as 5 | 7 | 9 | 13,
            );
        }
        await setupExistingGame(ns, client);
        try {
            await playGame(ns, client);
        } catch (err) {
            ns.print(`error ${String(err)}`);
        }
    }
}

async function setupExistingGame(ns: NS, client: GtpClient) {
    await client.clearBoard();

    const board = ns.go.getBoardState();
    await client.boardsize(board.length);

    const gameState = ns.go.getGameState();
    await client.komi(gameState.komi);

    const walls = filterMapBoard(board, isWall);
    if (walls.length > 0) await client.setWalls(walls);

    const positions = filterMapBoard(board, vertexToMove);
    if (positions.length > 0) await client.setPosition(positions);
}

function isWall(node: Node, vertex: Vertex): Vertex | null {
    if (node === Node.DISABLED) return vertex;
    return null;
}

function vertexToMove(node: Node, vertex: Vertex): Move | null {
    switch (node) {
        case Node.BLACK: {
            return ['black', vertex];
        }
        case Node.WHITE: {
            return ['white', vertex];
        }
        case Node.DISABLED:
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

        let opponentMove;
        if (myMove === 'pass') {
            opponentMove = await ns.go.passTurn();
        } else if (myMove === 'resign') {
            throw new Error(`ERROR: engine returned 'resign' unexpectedly!`);
        } else {
            let [x, y] = toIndices(myMove);
            const isPassMove = x === -1 && y === -1;

            if (!(isPassMove || validMoves[x][y])) {
                const board = ns.go.getBoardState();
                const validMoves = ns.go.analysis.getValidMoves();

                const [newX, newY] = randomNearInvalidMove(validMoves, [x, y]);
                if (newX !== -1 && newY !== -1) {
                    x = newX;
                    y = newY;
                } else {
                    [x, y] = getRandomMove(board, validMoves);
                }
            }
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
                await ns.sleep(10);
                break;
            }
            case 'gameOver': {
                return;
            }
        }
        await ns.sleep(0);
    }
}
