import type { NS } from 'netscript';

import { GtpClient } from 'go/GtpClient';
import { filterMapBoard, Node, Vertex } from 'go/types';

export async function main(ns: NS) {
    const client = new GtpClient(ns);
}

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

    const disabled = disabledNodes(board);
    await client.setFreeHandicap(disabled);
}
