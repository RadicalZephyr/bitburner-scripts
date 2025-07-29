import type { NS } from 'netscript';

import { GtpClient } from 'go/GtpClient';
import { filterMapBoard, Move, Node, Vertex } from 'go/types';

export async function main(ns: NS) {
    const client = new GtpClient(ns);

    await setupExistingGame(ns, client);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function disabledNodes(board: string[]): Vertex[] {
    return filterMapBoard(board, (node, vertex) =>
        node === Node.DISABLED ? vertex : undefined,
    );
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
