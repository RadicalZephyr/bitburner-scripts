import { ALLOC_ID, ALLOC_ID_DEFAULT, MEM_TAG_FLAGS, } from 'services/client/memory_tag';
import { parseAndRegisterAlloc } from 'services/client/memory';
/**
 * Parse command line flags.
 *
 * @remarks
 *
 * Allows Unix-like flag parsing. See for full details {@link NS.flags}.
 *
 * @param ns         - Netscript API instance
 * @param schema     - Flags schema
 * @param claimAlloc - Whether to send a claim message to the allocator for an alloc id arg
 * @returns Object containing keys for all flags and '_' containing non-flag arguments
 */
export async function parseFlags(ns, schema, claimAlloc = true) {
    const options = ns.flags([
        ...schema,
        ...MEM_TAG_FLAGS,
    ]);
    const allocationId = await parseAndRegisterAlloc(ns, options, claimAlloc);
    if (typeof options[ALLOC_ID] === 'number'
        && options[ALLOC_ID] !== ALLOC_ID_DEFAULT
        && allocationId === null) {
        throw new Error(`failed to register allocation id ${allocationId}`);
    }
    for (const [key, def] of schema) {
        if (typeof options[key] !== typeof def) {
            throw new Error(
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            `flag '--${key} ${options[key]}' somehow parsed as the wrong type: '${typeof options[key]}'. Default value: '${def}' `);
        }
    }
    return options;
}
