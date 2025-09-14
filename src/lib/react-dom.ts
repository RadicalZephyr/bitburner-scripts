import { assertGlobal } from 'util/script-import';

export const ReactDOM = assertGlobal<typeof import('react-dom')>(
    'ReactDOM',
    'Global ReactDOM not found!',
);
