import { assertGlobal } from 'util/script-import';

export const React = assertGlobal<typeof import('react')>(
    'React',
    'Global React not found!',
);
