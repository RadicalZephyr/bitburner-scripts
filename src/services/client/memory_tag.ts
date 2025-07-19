export const ALLOC_ID = "allocation-id";
const TAG_NAME = "allocId";

export const ALLOC_ID_ARG = `--${ALLOC_ID}`;
export const TAG_ARG = `--${TAG_NAME}`;

export const MEM_TAG_FLAGS = [
    [ALLOC_ID, -1],
    [TAG_NAME, -1]
] satisfies [string, string | number | boolean | string[]][];
