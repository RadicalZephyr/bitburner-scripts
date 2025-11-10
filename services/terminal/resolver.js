import { normalizePath, splitDirBase } from 'services/terminal/vfs';
const HOME = 'home';
/**
 * Create a resolver that locates scripts on the home server.
 *
 * @param ns - Netscript API instance.
 * @param options - Optional alias mapping used to resolve script shortcuts.
 * @returns A function that resolves script identifiers into script file paths.
 */
export function createScriptResolver(ns, options = {}) {
    const aliases = options.aliases ?? {};
    return (cwd, name) => {
        const trimmed = name.trim();
        if (!trimmed) {
            return { ok: false, message: 'missing script name' };
        }
        const alias = aliases[trimmed];
        const target = alias ?? trimmed;
        const normalized = normalizePath(target, cwd);
        const { dir, base } = splitDirBase(normalized);
        const candidates = hasExtension(base)
            ? [base]
            : [`${base}.js`, `${base}.ts`];
        for (const candidate of candidates) {
            const absPath = dir === '/' ? `/${candidate}` : `${dir}/${candidate}`;
            const scriptPath = absPath.slice(1);
            if (ns.fileExists(scriptPath, HOME)) {
                return { ok: true, absPath, script: scriptPath };
            }
        }
        const hint = candidates
            .map((candidate) => {
            const absPath = dir === '/' ? `/${candidate}` : `${dir}/${candidate}`;
            return `- ${absPath}`;
        })
            .join('\n');
        const message = alias
            ? `alias "${trimmed}" points to missing script:\n${hint}`
            : `unable to resolve script:\n${hint}`;
        return { ok: false, message };
    };
}
function hasExtension(script) {
    return (script.includes('.')
        && !script.endsWith('.')
        && script.indexOf('.') !== 0);
}
