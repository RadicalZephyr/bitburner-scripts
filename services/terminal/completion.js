import { listImmediateChildren, normalizePath, splitDirBase, } from 'services/terminal/vfs';
/**
 * Compute the completion candidates for a partially typed filesystem path.
 *
 * @param tokenValue - Raw token value extracted from the terminal input.
 * @param cwd - Current working directory expressed as an absolute path.
 * @param paths - File paths known on the home server.
 * @returns The shared prefix, the typed base segment, and matching children.
 */
export function computePathMatches(tokenValue, cwd, paths) {
    const raw = tokenValue;
    const normalizedInput = raw === '' ? './' : raw;
    const absPath = normalizePath(normalizedInput, cwd);
    const treatAsDir = raw.endsWith('/') || raw === '';
    const { dir } = splitDirBase(absPath);
    const searchDir = treatAsDir ? absPath : dir;
    const slashIndex = raw.lastIndexOf('/');
    const prefix = treatAsDir
        ? raw
        : slashIndex >= 0
            ? raw.slice(0, slashIndex + 1)
            : '';
    const localBase = treatAsDir
        ? ''
        : slashIndex >= 0
            ? raw.slice(slashIndex + 1)
            : raw;
    const listing = listImmediateChildren(paths, searchDir);
    const matches = listing.entries.filter((entry) => entry.name.startsWith(localBase));
    return { prefix, base: localBase, matches };
}
