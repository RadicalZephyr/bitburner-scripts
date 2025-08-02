/* eslint-disable @typescript-eslint/no-require-imports */

const { spawn } = require('node:child_process');
const readline = require('node:readline');
const express = require('express');
const querystring = require('querystring');
const cors = require('cors');
const morgan = require('morgan');

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

app.get('/boardsize/:n', async (req, res) => {
    try {
        const reply = await sendCommand(`boardsize ${req.params.n}`);
        res.status(200).json(reply);
    } catch (err) {
        res.json(error(String(err)));
    }
});

app.get('/clear_board', async (_req, res) => {
    try {
        const reply = await sendCommand('clear_board');
        res.status(200).json(reply);
    } catch (err) {
        res.json(error(String(err)));
    }
});

app.get('/komi/:value', async (req, res) => {
    try {
        const reply = await sendCommand(`komi ${req.params.value}`);
        res.status(200).json(reply);
    } catch (err) {
        res.json(error(String(err)));
    }
});

app.get('/set_walls/:encoded', async (req, res) => {
    try {
        const data = querystring.unescape(req.params.encoded);
        const reply = await sendCommand(`set_walls ${data}`);
        res.status(200).json(reply);
    } catch (err) {
        res.json(error(String(err)));
    }
});

app.get('/set_position/:encoded', async (req, res) => {
    try {
        const data = querystring.unescape(req.params.encoded);
        const reply = await sendCommand(`set_position ${data}`);
        res.status(200).json(reply);
    } catch (err) {
        res.json(error(String(err)));
    }
});

app.get('/set_free_handicap/:encoded', async (req, res) => {
    try {
        const data = querystring.unescape(req.params.encoded);
        const reply = await sendCommand(`set_free_handicap ${data}`);
        res.status(200).json(reply);
    } catch (err) {
        res.json(error(String(err)));
    }
});

app.get('/play/:color/:vertex', async (req, res) => {
    try {
        const color = req.params.color;
        const vertex = req.params.vertex;
        const reply = await sendCommand(`play ${color} ${vertex}`);
        res.status(200).json(reply);
    } catch (err) {
        res.json(error(String(err)));
    }
});

app.get('/genmove/:color', async (req, res) => {
    try {
        const color = req.params.color;
        const reply = await sendCommand(`genmove ${color}`);
        res.status(200).json(reply);
    } catch (err) {
        res.json(error(String(err)));
    }
});

app.get('/kata-search/:color', async (req, res) => {
    try {
        const color = req.params.color;
        const reply = await sendCommand(`kata-search ${color}`);
        res.status(200).json(reply);
    } catch (err) {
        res.json(error(String(err)));
    }
});

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
