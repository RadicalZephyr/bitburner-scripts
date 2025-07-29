import type { NS } from 'netscript';

import { COL_NAMES, Color, Move, ROW_NAMES, Vertex } from 'go/types';
import { extend } from 'util/extend';

type Command =
    | 'boardsize'
    | 'clear_board'
    | 'komi'
    | 'set_free_handicap'
    | 'set_position'
    | 'play'
    | 'genmove'
    | 'kata-search';
interface Response {
    status: 'OK' | 'ERROR';
    response: string;
}
const URL = 'localhost';
const PORT = '18924';
const RESPONSE_FILE = 'response.json';
export class GtpClient {
    ns: NS;

    constructor(ns: NS) {
        this.ns = ns;
    }

    /**
     * Set the board size for the next game.
     *
     * @param n - integer board size
     */
    async boardsize(n: number) {
        await this.send('boardsize', `${n}`);
    }

    /**
     * Clear the current board from the engine.
     */
    async clearBoard() {
        await this.send('clear_board', undefined);
    }

    /**
     * Set komi value for the game.
     *
     * @param value - floating point komi value
     */
    async komi(value: number) {
        await this.send('komi', value.toFixed(3));
    }

    /**
     * Set an entire board position at once.
     *
     * This avoids biasing KataGos analysis with a sequence of `play`
     * commands that don't represent actual play.
     *
     * @param positions - list of alternating color and vertex pairs
     */
    async setPosition(positions: Move[]) {
        const flatPositions = positions.reduce((acc, n) => extend(acc, n), []);
        await this.send(
            'set_position',
            encodeURIComponent(JSON.stringify(flatPositions)),
        );
    }

    /**
     * Set free placement handicap stones for black.
     *
     * @param vertices - vertices to place handicap stones on
     */
    async setFreeHandicap(vertices: Vertex[]) {
        await this.send(
            'set_free_handicap',
            encodeURIComponent(JSON.stringify(vertices)),
        );
    }

    /**
     * Inform the engine of a move played outside the engine.
     *
     * @param color - color to play move for
     * @param vertex - vertex to play move at
     */
    async play(color: Color, vertex: Vertex) {
        await this.send('play', `${color}/${vertex}`);
    }

    /**
     * Retrieve the next move KataGo wants to play.
     *
     * @param color - color to generate move for
     * @returns vertex to play move at
     */
    async genmove(color: Color): Promise<string> {
        return await this.send('genmove', color);
    }

    /**
     * Retrieve the next move KataGo wants to play, without playing it
     * in the engine.
     *
     * If this move is valid, client _must_ follow up by calling
     * `GtpClient.play()` with this move to inform the engine.
     *
     * @param color - color to generate move for
     * @returns vertex to play move at
     */
    async kataSearch(color: Color): Promise<string> {
        return await this.send('kata-search', color);
    }

    private async send(cmd: Command, payload: string): Promise<string> {
        const responseStatus = await this.ns.wget(
            `http://${URL}:${PORT}/${cmd}/${payload}`,
            RESPONSE_FILE,
        );

        if (!responseStatus) {
            throw new Error('wget failed to retrieve file');
        }
        await this.ns.sleep(30); // TODO: is this necessary?

        if (!this.ns.fileExists(RESPONSE_FILE)) {
            throw new Error('wget failed to write file');
        }

        const response = parseResponse(JSON.parse(this.ns.read(RESPONSE_FILE)));
        if (response.status !== 'OK')
            throw new Error(`request ${cmd} failed: ${response.response}`);

        return response.response;
    }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseResponse(o: any): Response {
    if (typeof o !== 'object')
        throw new Error(`response was not an object: ${JSON.stringify(o)}`);
    if (!(Object.hasOwn(o, 'status') && Object.hasOwn(o, 'response')))
        throw new Error(
            `response is missing required keys ${JSON.stringify(o)}`,
        );

    return o as Response;
}

export function toIndices(vertex: Vertex): [number, number] {
    const x = ROW_NAMES.findIndex((rowName) =>
        vertex.startsWith(rowName.toString()),
    );
    if (x === -1)
        throw new Error(`tried to transform invalid vertex ${vertex}`);

    const y = COL_NAMES.findIndex((colName) => vertex.endsWith(colName));
    if (y === -1)
        throw new Error(`tried to transform invalid vertex ${vertex}`);

    return [x, y];
}

export function toVertex(x: number, y: number): Vertex {
    if (x >= COL_NAMES.length)
        throw new Error(`tried to generate vertex with invalid col index ${x}`);

    if (y >= ROW_NAMES.length)
        throw new Error(`tried to generate vertex with invalid row index ${y}`);

    const col = COL_NAMES[x];
    const row = ROW_NAMES[y];
    return `${col}${row}` as Vertex;
}
