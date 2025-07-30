import type { NS } from 'netscript';

import { Color, Move, MoveResponse, Vertex, isMoveResponse } from 'go/types';

import { CONFIG } from 'go/config';
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

export class GtpClient {
    ns: NS;
    requestId: number = 1;

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
        await this.send('clear_board');
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
    async genmove(color: Color): Promise<MoveResponse> {
        const vertex = await this.send('genmove', color);
        const lowcaseVertex = vertex.toLocaleLowerCase().trim();
        if (!isMoveResponse(lowcaseVertex))
            throw new Error(`genmove returned invalid vertex ${lowcaseVertex}`);
        return lowcaseVertex;
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
    async kataSearch(color: Color): Promise<MoveResponse> {
        const vertex = await this.send('kata-search', color);
        const lowcaseVertex = vertex.toLocaleLowerCase().trim();
        if (!isMoveResponse(lowcaseVertex))
            throw new Error(
                `kata-search returned invalid vertex ${lowcaseVertex}`,
            );
        return lowcaseVertex;
    }

    private responseFile() {
        const file = `response${this.requestId}.json`;
        this.requestId += 1;
        return file;
    }

    private async send(cmd: Command, payload?: string): Promise<string> {
        const url = CONFIG.gtpProxyHost;
        const port = CONFIG.gtpProxyPort;

        const argument = payload !== undefined ? `/${payload}` : '';
        this.ns.print(`INFO: sending ${cmd}${argument}`);

        const responseFile = this.responseFile();
        const responseStatus = await this.ns.wget(
            `http://${url}:${port}/${cmd}${argument}`,
            responseFile,
        );

        if (!responseStatus) {
            throw new Error('wget failed to retrieve file');
        }

        if (!this.ns.fileExists(responseFile)) {
            throw new Error('wget failed to write file');
        }
        const responseContent = this.ns.read(responseFile);
        this.ns.rm(responseFile);

        const response = parseResponse(JSON.parse(responseContent));
        if (response.status !== 'OK')
            throw new Error(`request ${cmd} failed: ${response.response}`);

        this.ns.print(
            `SUCCESS: received successful response '${response.response}'`,
        );

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
