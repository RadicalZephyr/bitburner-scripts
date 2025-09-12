/**
 * Compare two values structurally.
 */
export function isStructuralEqual(a: unknown, b: unknown): boolean {
    if (typeof a !== typeof b) return false;


    return a === b;
}
