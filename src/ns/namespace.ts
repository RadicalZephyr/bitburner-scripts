import type { NS } from '@ns';

import type { NsPlugin } from 'ns/extend';

export function namespaced<
    K extends string | symbol,
    TExtras extends Record<string | symbol, unknown>,
>(
    nsKey: K,
    config: {
        /** A unique plugin name; default derives from key */
        name?: string;
        /** Build the inner extras that live under ns[nsKey] */
        setup(
            this: void,
            ns: NS,
            ctx: {
                onExit(this: void, fn: () => void): void;
                signal: AbortSignal;
            },
        ): TExtras;
    },
): NsPlugin<TExtras> & { __nsKey__: K } {
    const name = config.name ?? `ns:${String(nsKey)}`;
    return {
        name,
        __nsKey__: nsKey,
        setup: config.setup,
    } as NsPlugin<TExtras> & { __nsKey__: K };
}
