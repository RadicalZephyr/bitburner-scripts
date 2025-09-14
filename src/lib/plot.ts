export type * from '@observablehq/plot';

import 'lib/d3';

import { importFromGlobal } from 'util/script-import';

export const Plot = await importFromGlobal<typeof import('@observablehq/plot')>(
    'https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6.17/dist/plot.umd.min.js',
    'Plot',
);
