import type { NS, ScriptArg } from 'netscript';

import {
    ALLOC_ID,
    ALLOC_ID_DEFAULT,
    MEM_TAG_FLAGS,
} from 'services/client/memory_tag';
import { parseAndRegisterAlloc } from 'services/client/memory';

type FlagsFn = NS['flags'];

/**
 * Type of the schema passed to the `ns.flags` function.
 */
export type FlagsSchema = Parameters<FlagsFn>[0];

type DefaultValue = string | number | boolean | string[];

type BaseOf<T> = T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends string
        ? string
        : T extends string[]
          ? string[]
          : never;

/**
 *
 */
export type ParsedFlags<S extends readonly [string, DefaultValue][]> = {
    [E in S[number] as E[0]]: BaseOf<E[1]>;
} & { _: ScriptArg[] };

/**
 * Parse command line flags.
 *
 * @remarks
 *
 * Allows Unix-like flag parsing. See for full details {@link NS.flags}.
 *
 * @param ns     - Netcript API instance
 * @param schema - Flags schema
 * @returns object containing keys for all flags and '_' containing non-flag arguments
 */
export async function parseFlags<S extends readonly [string, DefaultValue][]>(
    ns: NS,
    schema: S,
): Promise<ParsedFlags<S>> {
    const options = ns.flags([
        ...schema,
        ...MEM_TAG_FLAGS,
    ] as unknown as FlagsSchema);

    const allocationId = await parseAndRegisterAlloc(ns, options);
    if (
        typeof options[ALLOC_ID] === 'number'
        && options[ALLOC_ID] !== ALLOC_ID_DEFAULT
        && allocationId === null
    ) {
        throw new Error(`failed to register allocation id ${allocationId}`);
    }

    for (const [key, def] of schema) {
        if (typeof options[key] !== typeof def) {
            throw new Error(
                `flag '--${key} ${options[key]}' somehow parsed as the wrong type: '${typeof options[key]}'. Default value: '${def}' `,
            );
        }
    }

    return options as ParsedFlags<S>;
}
