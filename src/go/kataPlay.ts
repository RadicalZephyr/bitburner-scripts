import type { NS } from 'netscript';

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
    const board = ns.go.getBoardState();
    const disabled = disabledNodes(board);
    ns.tprint(`disabled nodes: ${JSON.stringify(disabled)}`);
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
