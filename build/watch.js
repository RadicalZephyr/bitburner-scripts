const fs = require('node:fs');
const path = require('node:path');
const syncDirectory = require('sync-directory');
const fg = require('fast-glob');
const chokidar = require('chokidar');
const { src, dist, allowedFiletypes } = require('./config');

// Do not exit the watcher on unexpected errors
process.on('uncaughtException', (err) => {
    console.error(err);
});

process.on('unhandledRejection', (err) => {
    console.error(err);
});

/** Format dist path for printing */
function normalize(p) {
    return p.replace(/\\/g, '/');
}

/**
 * Sync static files.
 * Include init and watch phase.
 */
async function syncStatic() {
    return syncDirectory.async(path.resolve(src), path.resolve(dist), {
        exclude: (file) => {
            const { ext } = path.parse(file);
            return ext && !allowedFiletypes.includes(ext);
        },
        async afterEachSync(event) {
            // log file action
            let eventType;
            if (event.eventType === 'add' || event.eventType === 'init:copy') {
                eventType = 'changed';
            } else if (event.eventType === 'unlink') {
                eventType = 'deleted';
            }
            if (eventType) {
                let relative = event.relativePath;
                if (relative[0] === '\\') {
                    relative = relative.substring(1);
                }
                console.log(`${normalize(relative)} ${eventType}`);
            }
        },
        watch: true,
        deleteOrphaned: true,
    });
}

/**
 * Sync ts script files.
 * Init phase only.
 */
async function initTypeScript() {
    const distFiles = await fg(`${dist}/**/*.js`);
    for (const distFile of distFiles) {
        // search existing *.js file in dist
        const relative = path.relative(dist, distFile);
        const srcFile = path.resolve(src, relative);
        // if srcFile does not exist, delete distFile
        if (
            !fs.existsSync(srcFile)
            && !fs.existsSync(srcFile.replace(/\.js$/, '.ts'))
        ) {
            try {
                await fs.promises.unlink(distFile);
            } catch (err) {
                if (err.code !== 'ENOENT') {
                    throw err;
                }
            }
            console.log(`${normalize(relative)} deleted`);
        }
    }
}

/**
 * Sync ts script files.
 * Watch phase only.
 */
async function watchTypeScript() {
    return chokidar
        .watch(src, {
            ignored: (filePath, stats) =>
                stats?.isFile() && !filePath.endsWith('.ts'),
        })
        .on('unlink', async (p) => {
            // called on *.ts file get deleted
            const relative = path.relative(src, p).replace(/\.ts$/, '.js');
            const distFile = path.resolve(dist, relative);
            // if distFile exists, delete it
            if (fs.existsSync(distFile)) {
                try {
                    await fs.promises.unlink(distFile);
                } catch (err) {
                    if (err.code !== 'ENOENT') {
                        throw err;
                    }
                }
                console.log(`${normalize(relative)} deleted`);
            }
        });
}

/**
 * Sync ts script files.
 * Include init and watch phase.
 */
async function syncTypeScript() {
    await initTypeScript();
    return await watchTypeScript();
}

async function main() {
    console.log('Start watching static and ts files...');

    const staticWatcher = await syncStatic(); // returns the sync-directory watcher
    const tsWatcher = await syncTypeScript(); // returns the chokidar watcher

    // Graceful shutdown
    process.on('SIGINT', async () => {
        await Promise.allSettled([
            staticWatcher?.close?.(),
            tsWatcher?.close?.(),
        ]);
        process.exit(0);
    });
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
