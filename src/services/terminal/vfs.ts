/**
 * Resolve an input path to an absolute, normalized path within the virtual
 * filesystem used by the terminal.
 *
 * @param input - Raw user supplied path.
 * @param cwd - Current working directory expressed as an absolute path.
 * @returns A normalized absolute path.
 */
export function normalizePath(input: string, cwd: string): string {
    const trimmed = input.trim();
    const base = trimmed === '' ? '.' : trimmed;

    let path = base;
    if (path.startsWith('~')) {
        path = `/${path.slice(1)}`;
    }

    const absolute = path.startsWith('/') ? path : joinPaths(cwd, path);

    const segments = absolute.split('/');
    const stack: string[] = [];

    for (const segment of segments) {
        if (segment === '' || segment === '.') {
            continue;
        }
        if (segment === '..') {
            if (stack.length > 0) {
                stack.pop();
            }
            continue;
        }
        stack.push(segment);
    }

    return `/${stack.join('/')}`.replace(/\/$/, '') || '/';
}

/**
 * Split an absolute path into directory and base name components.
 *
 * @param absPath - Absolute path returned by {@link normalizePath}.
 * @returns The directory portion and base name.
 */
export function splitDirBase(absPath: string): { dir: string; base: string } {
    if (!absPath.startsWith('/')) {
        throw new Error(`path must be absolute: ${absPath}`);
    }

    if (absPath === '/') {
        return { dir: '/', base: '' };
    }

    const normalized =
        absPath.endsWith('/') && absPath !== '/'
            ? absPath.slice(0, -1)
            : absPath;

    const index = normalized.lastIndexOf('/');
    if (index <= 0) {
        return { dir: '/', base: normalized.slice(1) };
    }
    return {
        dir: normalized.slice(0, index) || '/',
        base: normalized.slice(index + 1),
    };
}

/**
 * Determine whether a directory is a prefix of a path.
 *
 * @param candidateDir - Directory to test.
 * @param path - Absolute path to inspect.
 * @returns True when {@link candidateDir} is the same path or an ancestor.
 */
export function isDirPrefix(candidateDir: string, path: string): boolean {
    if (!candidateDir.startsWith('/') || !path.startsWith('/')) {
        return false;
    }
    if (candidateDir === '/') {
        return true;
    }
    const normalized = candidateDir.endsWith('/')
        ? candidateDir
        : `${candidateDir}/`;
    return path === candidateDir || path.startsWith(normalized);
}

export interface PathChild {
    name: string;
    absolutePath: string;
    kind: 'file' | 'dir';
}

/**
 * Produce a listing of the immediate children under a directory.
 *
 * @param paths - Absolute or relative file paths present on the host.
 * @param target - Absolute directory or file to enumerate.
 * @returns Sorted directory entries and an existence flag.
 */
export function listImmediateChildren(
    paths: string[],
    target: string,
): { entries: PathChild[]; exists: boolean } {
    const normalizedTarget = target === '/' ? '/' : target.replace(/\/+$/, '');
    const prefix = normalizedTarget === '/' ? '/' : `${normalizedTarget}/`;
    const dirEntries = new Map<string, PathChild>();
    const fileEntries = new Map<string, PathChild>();
    let exists = normalizedTarget === '/';

    for (const raw of paths) {
        const absolute = toAbsolute(raw);
        if (absolute === normalizedTarget) {
            exists = true;
            const { base } = splitDirBase(absolute);
            fileEntries.set(base, {
                name: base,
                absolutePath: absolute,
                kind: 'file',
            });
            continue;
        }
        if (!absolute.startsWith(prefix)) {
            continue;
        }
        const remainder = absolute.slice(prefix.length);
        if (remainder === '') {
            exists = true;
            continue;
        }
        exists = true;
        const [first, ...rest] = remainder.split('/');
        if (!first) {
            continue;
        }
        const absChild =
            normalizedTarget === '/'
                ? `/${first}`
                : `${normalizedTarget}/${first}`;
        if (rest.length === 0) {
            fileEntries.set(first, {
                name: first,
                absolutePath: absChild,
                kind: 'file',
            });
            continue;
        }
        dirEntries.set(first, {
            name: `${first}/`,
            absolutePath: absChild,
            kind: 'dir',
        });
    }

    const entries = [...dirEntries.values(), ...fileEntries.values()].sort(
        (a, b) => {
            if (a.kind !== b.kind) {
                return a.kind === 'dir' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        },
    );

    return { entries, exists };
}

/**
 * Check whether a directory contains any files.
 *
 * @param paths - Absolute or relative file paths present on the host.
 * @param dir - Directory path to test.
 * @returns True when the directory exists.
 */
export function directoryExists(paths: string[], dir: string): boolean {
    if (dir === '/') {
        return true;
    }
    const normalized = dir.replace(/\/+$/, '');
    const prefix = `${normalized}/`;
    for (const raw of paths) {
        const absolute = toAbsolute(raw);
        if (absolute.startsWith(prefix) && absolute !== normalized) {
            return true;
        }
    }
    return false;
}

function joinPaths(left: string, right: string): string {
    if (!left.startsWith('/')) {
        throw new Error(`cwd must be absolute: ${left}`);
    }
    if (left === '/') {
        return `/${right}`;
    }
    return `${left}/${right}`;
}

function toAbsolute(path: string): string {
    return path.startsWith('/') ? path : `/${path}`;
}
