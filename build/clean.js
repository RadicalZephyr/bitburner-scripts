import { unlink } from 'node:fs/promises';
import { resolve } from 'node:path';

import chokidar from 'chokidar';

const MATCH_TS_PATTERN = /^(.*)\.tsx?$/;

function watch(src, dist) {
    const watcher = chokidar
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
                    if (err?.code === 'ENOENT') {
                        console.log(
                            `Removed file "${f}" does not exist in dist`,
                        );
                    } else {
                        console.error(`Error removing "${f}":`, err);
                    }
                }
            }
        });
    console.log(`Watching in "${src}"`);
    return watcher;
}

const root = process.cwd();
const src = resolve(root, 'src/');
const dist = resolve(root, 'dist/');

const watcher = watch(src, dist);

// Close the watcher on Ctrl+C to avoid dangling file descriptors.
process.on('SIGINT', () => {
    watcher.close().finally(() => process.exit(0));
});
