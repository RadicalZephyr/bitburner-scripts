import type { NS } from '@ns';

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
}

const META = new WeakMap<NS, ProxyMeta>();

function ensureCore(ns: NS): ProxyMeta {
    const cached = META.get(ns);
    if (cached) return cached;

    const extras: ExtraRecord = {};
    const ctrl = new AbortController();
    const hooks = new Set<() => void>();

    ns.atExit(() => {
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
    });

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

    const meta: ProxyMeta = { prox, extras, ctrl, hooks };
    META.set(ns, meta);
    return meta;
}

/** Compose any number of plugins into a single proxy (reused per ns). */
export function usePlugins<T extends NS, P extends NsPlugin[]>(
    ns: T,
    ...plugins: P
): T & UnionExtras<P> {
    const { prox, extras, hooks, ctrl } = ensureCore(ns);

    const ctx = {
        onExit(fn: () => void) {
            hooks.add(fn);
        },
        signal: ctrl.signal,
    };

    for (const p of plugins) {
        const raw = p.setup(ns, ctx) || {};
        let provided: ExtraRecord;

        if (p.__nsKey__ != null) {
            // mount under a single namespace key, frozen to avoid accidental runtime mutation
            const key = p.__nsKey__;
            if (key in extras) {
                throw new Error(
                    `ns-compose: plugin "${p.name}" tried to mount duplicate namespace ${String(key)}`,
                );
            }
            provided = { [key]: Object.freeze(raw) };
        } else {
            provided = raw;
        }

        // flat collision guard
        for (const k of Reflect.ownKeys(provided)) {
            if (k in extras) {
                throw new Error(
                    `ns-compose: plugin "${p.name}" defines duplicate key ${String(k)}`,
                );
            }
        }
        Object.assign(extras, provided);
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
