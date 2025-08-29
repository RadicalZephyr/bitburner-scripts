export type Validator<T> = (v: unknown) => v is T;

/**
 * Type predicate for undefined values
 */
export const isUndefined: Validator<undefined> = (v): v is undefined =>
    typeof v === 'undefined';

/**
 * Type predicate for null values
 */
export const isNull: Validator<null> = (v): v is null =>
    !v && typeof v === 'object';

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
 * Type predicate for arrays of unknown values
 */
export const isArrayUnknown: Validator<Array<unknown>> = (
    v,
): v is Array<unknown> => typeof v === 'object' && Array.isArray(v);

/**
 * Type predicate constructor for arrays with values of a known type
 */
export function makeIsArray<T>(validateEl: Validator<T>): Validator<Array<T>> {
    return (v): v is Array<T> =>
        typeof v === 'object' && Array.isArray(v) && v.every(validateEl);
}

export type ProtocolDef = Record<
    string,
    {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payload: Validator<any>;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        response?: Validator<any>; // optional, cannot receive replies if missing
    }
>;
