import { isObjectUnknown } from 'util/validate';

/**
 * Compare two values structurally.
 */
export function isStructuralEqual(a: unknown, b: unknown): boolean {
    if (typeof a !== typeof b) return false;

    if (typeof a === 'object') {
        if (Array.isArray(a) && Array.isArray(b))
            return isArrayStructuralEquals(a, b);

        if (isObjectUnknown(a) && isObjectUnknown(b))
            return isObjectStructuralEqual(a, b);
    }

    return a === b;
}

export function isArrayStructuralEquals(
    a: readonly unknown[],
    b: readonly unknown[],
): boolean {
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length && i < b.length; i++) {
        if (!isStructuralEqual(a[i], b[i])) return false;
    }

    return true;
}

export function isObjectStructuralEqual(a: object, b: object): boolean {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;

    for (const k of aKeys) {
        if (!(k in b)) return false;

        if (!isStructuralEqual(a[k], b[k])) return false;
    }

    return true;
}
