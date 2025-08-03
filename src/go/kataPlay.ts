import type { AutocompleteData, GoOpponent, NS } from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

import { GtpClient } from 'go/GtpClient';
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
        await playGame(ns, client);
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
    let repeatedErrors = 0;
    const errorMoves = [];

    let opponentPasses = 0;
    while (true) {
        const validMoves = ns.go.analysis.getValidMoves();

        let myMove;
        if (opponentPasses < CONFIG.maxOpponentPasses) {
            // Have the engine generate the next move
            myMove = await client.genmove('black');
        } else {
            myMove = 'pass';
        }

        let opponentMove;
        if (myMove === 'pass') {
            opponentMove = await ns.go.passTurn();
        } else if (myMove === 'resign') {
            throw new Error(`ERROR: engine returned 'resign' unexpectedly!`);
        } else {
            const [x, y] = toIndices(myMove);

            if (!validMoves[x][y]) {
                repeatedErrors += 1;
                errorMoves.push(myMove);

                if (repeatedErrors >= CONFIG.maxEngineInvalidMoves) {
                    ns.print(
                        `ERROR: resetting game. KataGo returned ${errorMoves.length} invalid moves: ${errorMoves.join(', ')}`,
                    );
                    ns.go.resetBoardState(
                        CONFIG.goOpponent as GoOpponent,
                        CONFIG.boardSize as 5 | 7 | 9 | 13,
                    );
                    return;
                }

                ns.print(`WARN: KataGo returned an invalid move: ${myMove}`);
                await client.clearCache();
                continue;
            }

            opponentMove = await ns.go.makeMove(x, y);
        }

        repeatedErrors = 0;
        errorMoves.length = 0;

        switch (opponentMove.type) {
            case 'move': {
                opponentPasses = 0;
                await client.play(
                    'white',
                    toVertex(opponentMove.x, opponentMove.y),
                );
                break;
            }
            case 'pass': {
                opponentPasses += 1;
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
