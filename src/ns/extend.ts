import type { NS } from '@ns';

import { makeFuid } from 'util/fuid';

type ExtraRecord = Record<string | symbol, unknown>;

export interface NsPlugin<TExtras = ExtraRecord> {
    /** Unique name for debugging */
    name: string;
    /** Install plugin. Return either flat extras or (with namespaced helper) inner extras. */
    setup(
        this: void,
        ns: NS,
        ctx: { onExit(this: void, fn: () => void): void; signal: AbortSignal },
    ): TExtras;
    /** Internal: set by `namespaced` helper to instruct composer to mount under a key */
    __nsKey__?: string | symbol;
}

interface ProxyMeta {
    prox: NS;
    extras: ExtraRecord;
    ctrl: AbortController;
    hooks: Set<() => void>;
    plugins: Set<string>;
}

const META = new WeakMap<NS, ProxyMeta>();

function ensureCore(ns: NS): ProxyMeta {
    const cached = META.get(ns);
    if (cached) return cached;

    const extras: ExtraRecord = {};
    const ctrl = new AbortController();
    const hooks = new Set<() => void>();
    const plugins = new Set<string>();

    ns.atExit(
        () => {
            for (const h of hooks) {
                try {
                    h();
                } catch {
                    /* ignore */
                }
            }
            try {
                ctrl.abort();
            } catch {
                /* ignore */
            }
        },
        `ns-extend-${makeFuid(ns)}`,
    );

    const prox = new Proxy(ns, {
        get(target, prop, receiver) {
            if (prop in extras) return extras[prop];
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return Reflect.get(target, prop, receiver);
        },
        has(target, prop) {
            return prop in extras || prop in target;
        },
        set() {
            throw new Error(
                'Cannot assign to properties on the composed ns proxy.',
            );
        },
    });

    const meta: ProxyMeta = { prox, extras, ctrl, hooks, plugins };
    META.set(ns, meta);
    META.set(prox, meta);
    return meta;
}

/**
 * Compose any number of plugins into a single proxy (reused per ns).
 *
 * @example Creating an extended NS and capturing the type
 *
 * When you need to pass the enhanced NS object and still retain
 * knowledge of the additional methods, you need to be able to name
 * the type returned by `withPlugins`. The easiest way to do this is
 * by defining a help function and capturing the return type in a type
 * alias.
 *
 * ```ts
 * import { withPlugins } from 'ns/extend';
 * import { alivePlugin } from 'ns/plugins/alive';
 * import { loggerPlugin } from 'ns/plugins/logger';
 *
 * function extendNs(ns: NS) {
 *     return withPlugins(ns, alivePlugin(), loggerPlugin());
 * }
 *
 * type NSX = ReturnType<typeof extendNs>;
 * ```
 */
export function withPlugins<T extends NS, P extends NsPlugin[]>(
    ns: T,
    ...plugins: P
): T & UnionExtras<P> {
    const { prox, extras, hooks, ctrl, plugins: installed } = ensureCore(ns);

    const ctx = {
        onExit(fn: () => void) {
            hooks.add(fn);
        },
        signal: ctrl.signal,
    };

    for (const p of plugins) {
        if (installed.has(p.name)) continue;

        if (p.__nsKey__ != null && p.__nsKey__ in extras) {
            installed.add(p.name);
            continue;
        }

        const raw = p.setup(ns, ctx) || {};
        let provided: ExtraRecord;

        if (p.__nsKey__ != null) {
            // mount under a single namespace key, frozen to avoid accidental runtime mutation
            const key = p.__nsKey__;
            provided = { [key]: Object.freeze(raw) };
        } else {
            provided = raw;
        }

        const providedKeys = Reflect.ownKeys(provided);
        if (providedKeys.length === 0) {
            installed.add(p.name);
            continue;
        }

        const duplicates = providedKeys.filter((key) => key in extras);
        if (duplicates.length > 0) {
            if (duplicates.length === providedKeys.length) {
                installed.add(p.name);
                continue;
            }
            throw new Error(
                `ns/extend: plugin "${p.name}" defines duplicate key(s)`,
                { cause: duplicates },
            );
        }

        Object.assign(extras, provided);
        installed.add(p.name);
    }

    return prox as T & UnionExtras<P>;
}

/* ---------- type plumbing for nice autocompletion ---------- */
type ExtrasOf<P extends NsPlugin> = ReturnType<P['setup']>;

type PluginSurface<P extends NsPlugin> = P['__nsKey__'] extends infer K
    ? K extends string | symbol
        ? { [NS in K]: Readonly<ExtrasOf<P>> }
        : ExtrasOf<P>
    : ExtrasOf<P>;

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type UnionExtras<P extends NsPlugin[], Acc = {}> = P extends [
    infer H,
    ...infer T,
]
    ? H extends NsPlugin
        ? T extends NsPlugin[]
            ? UnionExtras<T, Acc & PluginSurface<H>>
            : Acc & PluginSurface<H>
        : Acc
    : Acc;
