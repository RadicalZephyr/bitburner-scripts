import { spawn } from 'node:child_process';
import readline from 'node:readline';
import express from 'express';
import querystring from 'querystring';
import cors from 'cors';
import morgan from 'morgan';

const engine = spawn('./katago', ['gtp'], {
    stdio: ['pipe', 'pipe', 'inherit'],
});

const rl = readline.createInterface({ input: engine.stdout });
const pending = [];
let buffer = [];

rl.on('line', (line) => {
    if (line.trim() === '') {
        const p = pending.shift();
        if (p?.resolve && typeof p.resolve === 'function') {
            const response = buffer.join('\n');
            const status = response.startsWith('=') ? 'OK' : 'ERROR';
            p.resolve({ status, response: response.slice(2) });
        }
        buffer = [];
    } else {
        buffer.push(line);
    }
});

/**
 * Send a command to the underlying GTP engine.
 *
 * @param {string} cmd - Command string to send.
 * @returns {Promise<string>} Resolves with the engine reply.
 */
function sendCommand(cmd) {
    return new Promise((resolve, reject) => {
        pending.push({ resolve, reject });
        engine.stdin.write(cmd + '\n');
    });
}

function error(msg) {
    return {
        status: 'ERROR',
        response: msg,
    };
}

const app = express();
const PORT = 18924;

app.use(cors(), morgan('dev'));

/**
 * Register an HTTP endpoint that forwards a command to the GTP engine.
 *
 * @param {string} route - Express route pattern.
 * @param {(req: import('express').Request) => string} commandBuilder - Builds the command string from the request.
 */
function handleCommand(app, route, commandBuilder) {
    app.get(route, async (req, res) => {
        try {
            const reply = await sendCommand(commandBuilder(req));
            res.status(200).json(reply);
        } catch (err) {
            res.json(error(String(err)));
        }
    });
}

handleCommand(app, '/boardsize/:n', (req) => `boardsize ${req.params.n}`);

handleCommand(app, '/clear_board', () => 'clear_board');

handleCommand(app, '/clear_cache', () => 'clear_cache');

handleCommand(app, '/komi/:value', (req) => `komi ${req.params.value}`);

handleCommand(app, '/set_walls/:encoded', (req) => {
    const data = querystring.unescape(req.params.encoded);
    return `set_walls ${data}`;
});

handleCommand(app, '/set_position/:encoded', (req) => {
    const data = querystring.unescape(req.params.encoded);
    return `set_position ${data}`;
});

handleCommand(app, '/set_free_handicap/:encoded', (req) => {
    const data = querystring.unescape(req.params.encoded);
    return `set_free_handicap ${data}`;
});

handleCommand(app, '/play/:color/:vertex', (req) => {
    const { color, vertex } = req.params;
    return `play ${color} ${vertex}`;
});

handleCommand(app, '/genmove/:color', (req) => `genmove ${req.params.color}`);

handleCommand(
    app,
    '/kata-search/:color',
    (req) => `kata-search ${req.params.color}`,
);

const INTERFACE = '0.0.0.0';
const server = app.listen(PORT, INTERFACE, () => {
    console.log(`GTP proxy listening on http://${INTERFACE}:${PORT}`);
});

function shutdown() {
    engine.kill();
    server.close(() => process.exit());
}

engine.on('exit', () => {
    for (const p of pending) {
        if (typeof p.reject === 'function') {
            p.reject('engine shutdown');
        }
    }
    server.close(() => process.exit());
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
