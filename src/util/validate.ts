/*---------------- Type Predicates ----------------*/

export type Validator<T> = (v: unknown) => v is T;

/**
 * Type predicate for undefined values
 */
export const isUndefined: Validator<undefined> = (v): v is undefined =>
    v === undefined;

/**
 * Type predicate for null values
 */
export const isNull: Validator<null> = (v): v is null => v === null;

/**
 * Type predicate for unknown not null or missing values
 */
export const isUnknown: Validator<unknown> = (v): v is unknown =>
    !isUndefined(v);

/**
 * Type predicate for boolean values
 */
export const isBoolean: Validator<boolean> = (v): v is boolean =>
    typeof v === 'boolean';

/**
 * Type predicate for number values
 */
export const isNumber: Validator<number> = (v): v is number =>
    typeof v === 'number';

/**
 * Type predicate for BigInt values
 */
export const isBigInt: Validator<bigint> = (v): v is bigint =>
    typeof v === 'bigint';

/**
 * Type predicate for string values
 */
export const isString: Validator<string> = (v): v is string =>
    typeof v === 'string';

/**
 * Type predicate for literal value types
 */
export function isLiteral<
    T extends string | number | boolean | null | undefined,
>(lit: T): Validator<T> {
    return (v: unknown): v is T => v === lit;
}

/**
 * Type predicate for optional values. Must be either the type, null or undefined.
 */
export function isOptional<T>(
    validator: Validator<T>,
): Validator<T | null | undefined> {
    return (v: unknown): v is T | null | undefined =>
        v === null || v === undefined || validator(v);
}

/**
 * Type predicate for arrays of unknown values
 */
export const isArrayUnknown: Validator<Array<unknown>> = (
    v,
): v is Array<unknown> => Array.isArray(v);

/**
 * Type predicate constructor for arrays with values of a known type
 */
export function isArrayOf<T>(validateEl: Validator<T>): Validator<T[]> {
    return (v): v is T[] => Array.isArray(v) && v.every(validateEl);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UnionFromValidators<Vs extends readonly Validator<any>[]> =
    Vs[number] extends Validator<infer U> ? U : never;

/**
 * Type predicate for unions
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isAnyOf<Vs extends readonly Validator<any>[]>(
    ...validators: Vs
): Validator<UnionFromValidators<Vs>> {
    return (v): v is UnionFromValidators<Vs> =>
        validators.some((val) => val(v));
}

/**
 * Type predicate for objects with unknown values
 */
export const isObjectUnknown: Validator<Record<string, unknown>> = (
    v,
): v is Record<string, unknown> =>
    typeof v === 'object' && v != null && !Array.isArray(v);

/**
 * Type predicate for error-like values
 */
export const isError: Validator<Error> = (v): v is Error => {
    return (
        v instanceof Error
        || (isObjectUnknown(v)
            && Object.hasOwn(v, 'name')
            && isString(v.name)
            && Object.hasOwn(v, 'message')
            && isString(v.message))
    );
};

/**
 * Type predicate for records of string to V
 */
export function isRecordOf<V>(
    valueValidator: Validator<V>,
): Validator<Record<string, V>> {
    return (v: unknown): v is Record<string, V> =>
        isObjectUnknown(v) && Object.keys(v).every((k) => valueValidator(v[k]));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ObjectSpec = Record<string, Validator<any>>;

type ObjectFor<Spec extends ObjectSpec> = {
    [K in keyof Spec]: Spec[K] extends Validator<infer R> ? R : never;
};

/**
 * Type predicate for objects with keys of specific types
 */
export function isObjectLike<const Spec extends ObjectSpec>(
    spec: Spec,
): Validator<ObjectFor<Spec>> {
    for (const k of Object.keys(spec)) {
        if (typeof spec[k] !== 'function')
            throw new Error(`ObjectSpec key ${k} is not a function!`);
    }

    return (v): v is ObjectFor<Spec> => {
        if (!isObjectUnknown(v)) return false;

        for (const k of Object.keys(spec)) {
            const validate = spec[k];
            if (!validate(v[k])) return false;
        }
        return true;
    };
}
