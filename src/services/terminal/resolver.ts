import type { NS } from '@ns';

export interface ResolveOk {
    ok: true;
    script: string;
}

export interface ResolveErr {
    ok: false;
    message: string;
}

export type ResolveResult = ResolveOk | ResolveErr;

export type ScriptResolver = (name: string) => ResolveResult;

export interface ResolverOptions {
    aliases?: Record<string, string>;
}

const HOME = 'home';

/**
 * Create a resolver that locates scripts on the home server.
 *
 * @param ns - Netscript API instance.
 * @param options - Optional alias mapping used to resolve script shortcuts.
 * @returns A function that resolves script identifiers into script file paths.
 */
export function createScriptResolver(
    ns: NS,
    options: ResolverOptions = {},
): ScriptResolver {
    const aliases = options.aliases ?? {};

    return (name: string): ResolveResult => {
        const trimmed = name.trim();
        if (!trimmed) {
            return { ok: false, message: 'missing script name' };
        }

        const alias = aliases[trimmed];
        const target = alias ?? trimmed;

        const candidates = hasExtension(target)
            ? [target]
            : [`${target}.js`, `${target}.ts`];

        for (const candidate of candidates) {
            if (ns.fileExists(candidate, HOME)) {
                return { ok: true, script: candidate };
            }
        }

        const hint = candidates.map((c) => `- ${c}`).join('\n');
        const message = alias
            ? `alias "${trimmed}" points to missing script:\n${hint}`
            : `unable to resolve script:\n${hint}`;

        return { ok: false, message };
    };
}

function hasExtension(script: string): boolean {
    return script.includes('.') && !script.endsWith('.');
}
