export type * from 'd3';

import { importFromGlobal } from 'util/script-import';

export const d3 = await importFromGlobal<typeof import('d3')>(
    'https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js',
    'd3',
    {
        integrity:
            'sha384-CjloA8y00+1SDAUkjs099PVfnY2KmDC2BZnws9kh8D/lX1s46w6EPhpXdqMfjK6i',
        crossOrigin: 'anonymous',
    },
);
