import type { NS } from 'netscript';

import { GtpClient } from 'go/GtpClient';
import { COL_NAMES, ROW_NAMES, Vertex } from 'go/types';

const INVALID_NODE = '#';

export async function main(ns: NS) {
    const client = new GtpClient(ns);
}

function disabledNodes(board: string[]): Vertex[] {
    const nodes = [];
    for (let i = 0; i < board.length; i++) {
        const col = COL_NAMES[i];
        const columnArray = board[i].split('');
        for (let j = 0; j < board.length; j++) {
            const node = columnArray[j];
            const row = ROW_NAMES[j];
            if (node === INVALID_NODE) {
                nodes.push(`${col}${row}` as Vertex);
            }
        }
    }
    return nodes;
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
