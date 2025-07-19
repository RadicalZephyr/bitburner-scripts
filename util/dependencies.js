/**
 * Collect all dependencies of a script recursively.
 *
 * @param ns      - Netscript API object
 * @param file    - Script file to collect dependencies from
 * @param visited - Dependencies we've visited so far
 * @returns Set of all transitive dependencies
 */
export function collectDependencies(ns, file, visited = new Set()) {
    if (visited.has(file))
        return visited;
    visited.add(file);
    ns.scp(file, ns.self().server, "home");
    const content = ns.read(file);
    if (typeof content === "string" && content.length > 0) {
        const regex = /^\s*import[^\n]*? from ["'](.+?)["']/gm;
        let match;
        while ((match = regex.exec(content)) !== null) {
            const dep = resolveImport(file, match[1]);
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
function resolveImport(base, importPath) {
    if (!importPath.endsWith(".js")) {
        importPath += ".js";
    }
    if (importPath.startsWith("./")) {
        const idx = base.lastIndexOf("/");
        const dir = idx >= 0 ? base.slice(0, idx + 1) : "";
        return dir + importPath.slice(2);
    }
    else if (importPath.startsWith("/")) {
        importPath = importPath.slice(1);
    }
    return importPath;
}
