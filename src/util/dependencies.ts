import type { NS } from '@ns';

/**
 * Collect all dependencies of a script recursively.
 *
 * @param ns      - Netscript API object
 * @param file    - Script file to collect dependencies from
 * @param visited - Dependencies we've visited so far
 * @returns Set of all transitive dependencies
 */
export function collectDependencies(
    ns: NS,
    file: string,
    visited = new Set<string>(),
): Set<string> {
    if (visited.has(file)) return visited;
    visited.add(file);
    ns.scp(file, ns.self().server, 'home');
    const content = ns.read(file);
    if (typeof content === 'string' && content.length > 0) {
        const regex = /^\s*(im|ex)port[^'"]*? from ["'](.+?)["']/gm;
        let match: RegExpExecArray | null;
        while ((match = regex['exec'](content)) !== null) {
            // Don't try to resolve dependencies for netscript import
            if (match[2] === '@ns') continue;
            const dep = resolveImport(ns, file, match[2]);
            collectDependencies(ns, dep, visited);
        }
    }
    return visited;
}

/**
 * Resolve an import relative to a base path
 *
 * @param base       - Base path
 * @param importPath - Import path
 * @returns Import path relative to base path
 */
function resolveImport(ns: NS, base: string, importPath: string): string {
    const extRE = /.*\.([jt]sx?|json)$/;

    if (!importPath.match(extRE)) {
        for (const ext of ['.ts', '.tsx', '.js', '.jsx', '.json']) {
            if (ns.fileExists(`${importPath}${ext}`, 'home')) importPath += ext;
        }
    }
    if (importPath.startsWith('./')) {
        const idx = base.lastIndexOf('/');
        const dir = idx >= 0 ? base.slice(0, idx + 1) : '';
        return dir + importPath.slice(2);
    } else if (importPath.startsWith('/')) {
        importPath = importPath.slice(1);
    }
    return importPath;
}
