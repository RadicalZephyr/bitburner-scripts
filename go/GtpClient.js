import { isMove } from 'go/types';
import { CONFIG } from 'go/config';
import { extend } from 'util/extend';
import { isLiteral, isObjectLike, isString, isUnionOf, } from 'util/validate';
export class GtpClient {
    ns;
    constructor(ns) {
        this.ns = ns;
    }
    /**
     * Set the board size for the next game.
     *
     * @param n - integer board size
     */
    async boardsize(n) {
        await this.send('boardsize', `${n}`);
    }
    /**
     * Clear the current board from the engine.
     */
    async clearBoard() {
        await this.send('clear_board');
    }
    /**
     * Clear the search tree and the neural net cache from the engine.
     */
    async clearCache() {
        await this.send('clear_cache');
    }
    /**
     * Set komi value for the game.
     *
     * @param value - floating point komi value
     */
    async komi(value) {
        await this.send('komi', value.toFixed(3));
    }
    /**
     * Set interior walls at vertex locations.
     *
     * @param locations - vertices to place walls on
     */
    async setWalls(locations) {
        await this.send('set_walls', encodeURIComponent(locations.join(' ')));
    }
    /**
     * Set an entire board position at once.
     *
     * This avoids biasing KataGos analysis with a sequence of `play`
     * commands that don't represent actual play.
     *
     * @param positions - list of alternating color and vertex pairs
     */
    async setPosition(positions) {
        const flatPositions = positions.reduce((acc, n) => extend(acc, n), []);
        await this.send('set_position', encodeURIComponent(flatPositions.join(' ')));
    }
    /**
     * Set free placement handicap stones for black.
     *
     * @param vertices - vertices to place handicap stones on
     */
    async setFreeHandicap(vertices) {
        await this.send('set_free_handicap', encodeURIComponent(vertices.join(' ')));
    }
    /**
     * Inform the engine of a move played outside the engine.
     *
     * @param color - color to play move for
     * @param vertex - vertex to play move at
     */
    async play(color, vertex) {
        await this.send('play', `${color}/${vertex}`);
    }
    /**
     * Retrieve the next move KataGo wants to play.
     *
     * @param color - color to generate move for
     * @returns vertex to play move at
     */
    async genmove(color) {
        const vertex = await this.send('genmove', color);
        const lowcaseVertex = vertex.toLocaleLowerCase().trim();
        if (!isMove(lowcaseVertex))
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
    async kataSearch(color) {
        const vertex = await this.send('kata-search', color);
        const lowcaseVertex = vertex.toLocaleLowerCase().trim();
        if (!isMove(lowcaseVertex))
            throw new Error(`kata-search returned invalid vertex ${lowcaseVertex}`);
        return lowcaseVertex;
    }
    async send(cmd, payload) {
        const url = CONFIG.gtpProxyHost;
        const port = CONFIG.gtpProxyPort;
        const argument = payload !== undefined ? `/${payload}` : '';
        this.ns.print(`INFO: sending ${cmd}${argument}`);
        const response = await this.makeRequest(`http://${url}:${port}/${cmd}${argument}`);
        if (response.status !== 'OK')
            throw new Error(`request ${cmd} failed: ${response.response}`);
        this.ns.print(`SUCCESS: received successful response '${response.response}'`);
        return response.response;
    }
    async makeRequest(url) {
        const responseContent = await makeRequest('GET', url);
        return parseResponse(JSON.parse(responseContent));
    }
}
const isResponse = isObjectLike({
    status: isUnionOf(isLiteral('OK'), isLiteral('ERROR')),
    response: isString,
});
function parseResponse(o) {
    if (!isResponse(o))
        throw new Error(`response is missing required keys ${JSON.stringify(o)}`);
    return o;
}
function makeRequest(method, url) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(method, url);
        xhr.onload = () => {
            if (xhr.status >= 200
                && xhr.status < 400
                && typeof xhr.response === 'string') {
                resolve(xhr.response);
            }
            else {
                reject(new Error(`${method} ${url}: ${xhr.status} ${xhr.statusText}`));
            }
        };
        xhr.onerror = () => {
            // {status: xhr.status, statusText: xhr.statusText,}
            reject(new Error(`error attempting to send '${method} ${url}'`));
        };
        xhr.send();
    });
}
