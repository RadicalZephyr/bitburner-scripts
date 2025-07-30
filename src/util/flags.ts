import type { NS } from 'netscript';

type FlagsFn = NS['flags'];

/**
 * Type of the schema passed to the `ns.flags` function.
 */
export type FlagsSchema = Parameters<FlagsFn>[0];
