/* eslint-disable @typescript-eslint/no-require-imports */

const { spawn } = require('node:child_process');
const readline = require('node:readline');
const express = require('express');

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
            resolve(buffer.join('\n'));
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

const app = express();
const PORT = 18924;

app.get('/boardsize/:n', async (req, res) => {
    try {
        const reply = await sendCommand(`boardsize ${req.params.n}`);
        res.send(reply);
    } catch (err) {
        res.status(500).send(String(err));
    }
});

app.get('/clear_board', async (_req, res) => {
    try {
        const reply = await sendCommand('clear_board');
        res.send(reply);
    } catch (err) {
        res.status(500).send(String(err));
    }
});

app.get('/komi/:value', async (req, res) => {
    try {
        const reply = await sendCommand(`komi ${req.params.value}`);
        res.send(reply);
    } catch (err) {
        res.status(500).send(String(err));
    }
});

app.get('/set_free_handicap/:encoded', async (req, res) => {
    try {
        const data = Buffer.from(req.params.encoded, 'base64').toString('utf8');
        const vertices = JSON.parse(data);
        const joined = vertices.join(' ');
        const reply = await sendCommand(`set_free_handicap ${joined}`);
        res.send(reply);
    } catch (err) {
        res.status(400).send(String(err));
    }
});

app.get('/play/:vertex', async (req, res) => {
    try {
        const vertex = req.params.vertex;
        await sendCommand(`play black ${vertex}`);
        const genmove = await sendCommand(`genmove white`);
        res.send(genmove);
    } catch (err) {
        res.status(500).send(String(err));
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
