export const ALLOC_ID = "allocId";

export const ALLOC_ID_ARG = `--${ALLOC_ID}`;

export const MEM_TAG_FLAGS = [
    [ALLOC_ID, -1]
] satisfies [string, string | number | boolean | string[]][];
