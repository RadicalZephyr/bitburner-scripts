import type { NS } from 'netscript';
import { GtpClient } from 'go/GtpClient';

const INVALID_NODE = '#';

const ROW_NAMES = [
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

export async function main(ns: NS) {
    const client = new GtpClient(ns);
}

function disabledNodes(board: string[]): string[] {
    const nodes = [];
    for (let i = 0; i < board.length; i++) {
        const row = ROW_NAMES[i];
        const columnArray = board[i].split('');
        for (let col = 0; col < board.length; col++) {
            const node = columnArray[col];
            if (node === INVALID_NODE) {
                nodes.push(`${row}${col + 1}`);
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
