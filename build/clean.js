import { access, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';

import chokidar from 'chokidar';

const MATCH_TS_PATTERN = /^(.*)\.tsx?$/;

function watch(src, dist) {
    chokidar
        .watch(src, {
            persistent: true,
            cwd: src,
        })
        .on('unlink', async (filename) => {
            // Check if it was a typescript file
            const match = filename.match(MATCH_TS_PATTERN);
            if (match) {
                const base = resolve(dist, match[1]);
                const f = base + '.js';
                try {
                    await unlink(f);
                    console.log(`Removed "${f}"`);
                } catch (err) {
                    console.log(`Removed file "${f}" does not exist in dist`);
                }
            }
        });
    console.log(`Watching in "${src}"`);
}

const root = process.cwd();
const src = resolve(root, 'src/');
const dist = resolve(root, 'dist/');

watch(src, dist);
