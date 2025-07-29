/* eslint-disable @typescript-eslint/no-require-imports */

const cors = require('cors');
const { spawn } = require('node:child_process');
const readline = require('node:readline');
const express = require('express');
const querystring = require('querystring');

const engine = spawn('./katago', ['gtp'], {
    stdio: ['pipe', 'pipe', 'inherit'],
});

const rl = readline.createInterface({ input: engine.stdout });
const pending = [];
let buffer = [];

rl.on('line', (line) => {
    if (line.trim() === '') {
        const resolve = pending.shift();
        if (resolve) {
            const response = buffer.join('\n');
            const status = response.startsWith('=') ? 'OK' : 'ERROR';
            resolve({ status, response: response.slice(2) });
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
    return new Promise((resolve) => {
        pending.push(resolve);
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

app.use(cors);

app.get('/boardsize/:n', async (req, res) => {
    try {
        const reply = await sendCommand(`boardsize ${req.params.n}`);
        res.json(reply);
    } catch (err) {
        res.json(error(String(err)));
    }
});

app.get('/clear_board', async (_req, res) => {
    try {
        const reply = await sendCommand('clear_board');
        res.json(reply);
    } catch (err) {
        res.json(error(String(err)));
    }
});

app.get('/komi/:value', async (req, res) => {
    try {
        const reply = await sendCommand(`komi ${req.params.value}`);
        res.json(reply);
    } catch (err) {
        res.json(error(String(err)));
    }
});

app.get('/set_position/:encoded', async (req, res) => {
    try {
        const data = querystring.unescape(req.params.encoded);
        const vertices = JSON.parse(data);
        const joined = vertices.join(' ');
        const reply = await sendCommand(`set_position ${joined}`);
        res.json(reply);
    } catch (err) {
        res.json(error(String(err)));
    }
});

app.get('/set_free_handicap/:encoded', async (req, res) => {
    try {
        const data = querystring.unescape(req.params.encoded);
        const vertices = JSON.parse(data);
        const joined = vertices.join(' ');
        const reply = await sendCommand(`set_free_handicap ${joined}`);
        res.json(reply);
    } catch (err) {
        res.json(error(String(err)));
    }
});

app.get('/play/:color/:vertex', async (req, res) => {
    try {
        const color = req.params.color;
        const vertex = req.params.vertex;
        const reply = await sendCommand(`play ${color} ${vertex}`);
        res.json(reply);
    } catch (err) {
        res.json(error(String(err)));
    }
});

app.get('/genmove/:color', async (req, res) => {
    try {
        const color = req.params.color;
        const reply = await sendCommand(`genmove ${color}`);
        res.json(reply);
    } catch (err) {
        res.json(error(String(err)));
    }
});

app.get('/kata-search/:color', async (req, res) => {
    try {
        const color = req.params.color;
        const reply = await sendCommand(`kata-search ${color}`);
        res.json(reply);
    } catch (err) {
        res.json(error(String(err)));
    }
});

const server = app.listen(PORT, 'localhost', () => {
    console.log(`GTP proxy listening on http://localhost:${PORT}`);
});

function shutdown() {
    engine.kill();
    server.close(() => process.exit());
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
