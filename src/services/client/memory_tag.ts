export const ALLOC_ID = 'allocId';
export const ALLOC_ID_DEFAULT = -1;

export const ALLOC_ID_ARG = `--${ALLOC_ID}`;

export const MEM_TAG_FLAGS = [[ALLOC_ID, ALLOC_ID_DEFAULT]] as const satisfies [
    string,
    string | number | boolean | string[],
][];
