import type { NS, ScriptArg } from 'netscript';

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
export function parseFlags<S extends readonly [string, DefaultValue][]>(
    ns: NS,
    schema: S,
): ParsedFlags<S> {
    const options = ns.flags(schema as unknown as FlagsSchema);

    for (const [key, def] of schema) {
        if (typeof options[key] !== typeof def) {
            throw new Error(
                `flag '--${key} ${options[key]}' somehow parsed as the wrong type: '${typeof options[key]}'. Default value: '${def}' `,
            );
        }
    }

    return options as ParsedFlags<S>;
}
