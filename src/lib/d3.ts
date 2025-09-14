export type * from 'd3';

import { importFromGlobal } from 'util/script-import';

export const d3 = await importFromGlobal<typeof import('d3')>(
    'https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js',
    'd3',
);
