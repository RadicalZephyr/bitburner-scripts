import fs from 'node:fs';
import { dist } from './config.js';

// ensure dist exist
if (!fs.existsSync(dist)) {
    fs.mkdirSync(dist);
}
