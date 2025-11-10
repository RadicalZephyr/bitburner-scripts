/*---------------- Type Predicates ----------------*/
/**
 * Type predicate for any value
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isAny = (v) => true;
/**
 * Type predicate for undefined values
 */
export const isUndefined = (v) => v === undefined;
/**
 * Type predicate for null values
 */
export const isNull = (v) => v === null;
/**
 * Type predicate for values that are defined (i.e., not `undefined`).
 */
export const isDefined = (v) => !isUndefined(v);
/**
 * Type predicate for boolean values
 */
export const isBoolean = (v) => typeof v === 'boolean';
/**
 * Type predicate for number values
 */
export const isNumber = (v) => typeof v === 'number';
/**
 * Type predicate for BigInt values
 */
export const isBigInt = (v) => typeof v === 'bigint';
/**
 * Type predicate for string values
 */
export const isString = (v) => typeof v === 'string';
/**
 * Type predicate for literal value types
 */
export function isLiteral(lit) {
    return (v) => v === lit;
}
/**
 * Type predicate for optional values. Must be either the type, null or undefined.
 */
export function isOptional(validator) {
    return (v) => v === null || v === undefined || validator(v);
}
/**
 * Type predicate for arrays of unknown values
 */
export const isArrayUnknown = (v) => Array.isArray(v);
/**
 * Type predicate constructor for arrays with values of a known type
 */
export function isArrayOf(validateEl) {
    return (v) => Array.isArray(v) && v.every(validateEl);
}
/**
 * Type predicate for unions
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isUnionOf(...validators) {
    return (v) => validators.some((val) => val(v));
}
/**
 * Type predicate for objects with unknown values
 */
export const isObjectUnknown = (v) => typeof v === 'object' && v != null && !Array.isArray(v);
/**
 * Type predicate for error-like values
 */
export const isError = (v) => {
    return (v instanceof Error
        || (isObjectUnknown(v)
            && Object.hasOwn(v, 'name')
            && isString(v.name)
            && Object.hasOwn(v, 'message')
            && isString(v.message)));
};
/**
 * Type predicate for tuples checking length and type sequence
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isTuple(...validators) {
    return (v) => {
        if (!(isArrayUnknown(v) && v.length === validators.length))
            return false;
        for (let i = 0; i < v.length; i++) {
            if (!validators[i](v[i]))
                return false;
        }
        return true;
    };
}
/**
 * Type predicate for records of string to V
 */
export function isRecordOf(valueValidator) {
    return (v) => isObjectUnknown(v) && Object.keys(v).every((k) => valueValidator(v[k]));
}
/**
 * Type predicate for objects with keys of specific types
 */
export function isObjectLike(spec) {
    for (const k of Object.keys(spec)) {
        if (typeof spec[k] !== 'function')
            throw new Error(`ObjectSpec key ${k} is not a function!`);
    }
    return (v) => {
        if (!isObjectUnknown(v))
            return false;
        for (const k of Object.keys(spec)) {
            const validate = spec[k];
            if (!validate(v[k]))
                return false;
        }
        return true;
    };
}
