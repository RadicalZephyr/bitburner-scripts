import { isObjectUnknown } from 'util/validate';

/**
 * Compare two values structurally.
 *
 * Only primitives, arrays, plain objects and `Map` are
 * supported. Types like `Set`, `Date`, and functions are always
 * compared using object identity. The algorithm also does not handle
 * cyclic references and will recurse infinitely if given such
 * structures.
 *
 * @param a - First value to compare
 * @param b - Second value to compare
 * @returns Whether {@link a} and {@link b} are structurally equal
 */
export function isStructuralEqual(a: unknown, b: unknown): boolean {
    if (typeof a !== typeof b) return false;

    if (typeof a === 'object') {
        if (Array.isArray(a) && Array.isArray(b))
            return isArrayStructuralEqual(a, b);

        if (a instanceof Map && b instanceof Map)
            return isMapStructuralEqual(a, b);

        if (isObjectUnknown(a) && isObjectUnknown(b))
            return isObjectStructuralEqual(a, b);
    }

    return a === b;
}

/**
 * Compare two arrays element by element using structural equality.
 *
 * @param a - First array to compare
 * @param b - Second array to compare
 * @returns Whether the arrays are structurally equal
 */
export function isArrayStructuralEqual(
    a: readonly unknown[],
    b: readonly unknown[],
): boolean {
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length && i < b.length; i++) {
        if (!isStructuralEqual(a[i], b[i])) return false;
    }

    return true;
}

/**
 * Compare two plain objects key-by-key using structural equality.
 *
 * @param a - First object to compare
 * @param b - Second object to compare
 * @returns Whether the objects are structurally equal
 */
export function isObjectStructuralEqual(
    a: Record<string, unknown>,
    b: Record<string, unknown>,
): boolean {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;

    for (const k of aKeys) {
        if (!(k in b)) return false;

        if (!isStructuralEqual(a[k], b[k])) return false;
    }

    return true;
}

/**
 * Compare two maps key-by-key using structural equality.
 *
 * @param a - First map to compare
 * @param b - Second map to compare
 * @returns Whether the two maps are structurally equal
 */
export function isMapStructuralEqual<K, V>(
    a: Map<K, V>,
    b: Map<K, V>,
): boolean {
    if (a.size !== b.size) return false;

    for (const k of a.keys()) {
        if (!isStructuralEqual(a.get(k), b.get(k))) return false;
    }

    return true;
}
