/*---------------- Type Predicates ----------------*/

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

/**
 * Type predicate for objects with unknown values
 */
export const isObjectUnknown: Validator<Record<string, unknown>> = (
    v,
): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/*---------------- Protocol Envelopes ----------------*/

export interface RequestEnvelope<T, I, R> {
    type: T;
    id: I;
    payload: R;
}

export type RequestUnknown = RequestEnvelope<unknown, string | null, unknown>;

export function isRequestUnknown(v: unknown): v is RequestUnknown {
    if (
        !isObjectUnknown(v)
        || !Object.hasOwn(v, 'type')
        || !Object.hasOwn(v, 'payload')
    )
        return false;

    if (
        Object.hasOwn(v, 'id')
        && !(isString(v.id) || isNull(v.id) || isUndefined(v.id))
    )
        return false;

    return true;
}

export interface ResponseEnvelope<T, R> {
    type: T;
    id: string;
    payload: R;
}

export type ResponseUnknown = ResponseEnvelope<unknown, unknown>;

export function isResponseUnknown(v: unknown): v is ResponseUnknown {
    return (
        isObjectUnknown(v)
        && Object.hasOwn(v, 'type')
        && Object.hasOwn(v, 'id')
        && isString(v.id)
        && Object.hasOwn(v, 'payload')
    );
}

/*---------------- Protocol Definitions ----------------*/

export type ProtocolDef = Record<
    string,
    {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payload: Validator<any>;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        response?: Validator<any>; // optional, cannot receive replies if missing
    }
>;

type IdOf<P extends ProtocolDef, K extends keyof P> = P[K] extends {
    response: Validator<unknown>;
}
    ? string
    : null;

type PayloadOf<P extends ProtocolDef, K extends keyof P> = P[K] extends {
    payload: Validator<infer A>;
}
    ? A
    : never;

export type AnyRequest<P extends ProtocolDef> = {
    [K in keyof P]: RequestEnvelope<K, IdOf<P, K>, PayloadOf<P, K>>;
}[keyof P];

export function defineProtocol<const P extends ProtocolDef>(def: P) {
    const types = new Set(Object.keys(def));

    /**
     * Type predicate for checking if a Request is valid.
     *
     * @remarks
     * - Message types with no response validator _must not_ have an id field set.
     * - Message types with a response validator _must_ have a string id field.
     *
     * The reason for this strict checking is to help validate
     * protocol usage errors. If no response validator is defined for
     * a message type, then this says that the protocol is defined
     * such that the client code will not wait for a response. If the
     * client code sends a string message id this signals that the
     * client code _is_ waiting for a response. If these two signals
     * are in opposition then there is an error in the protocol
     * implementation and the request is invalid.
     *
     * @param v - Message envelope object to check
     * @param k - Message type to check
     * @returns Whether this message has known type and a well formed payload for it's type
     */
    function isRequest(m: RequestUnknown): m is AnyRequest<P> {
        if (!types.has(String(m.type))) return false;
        const spec = def[m.type as keyof P];
        if (!spec || typeof spec.payload !== 'function') return false;
        if (spec.response) {
            // Response validator is defined, must have id field
            if (!isString(m.id)) return false;
        } else {
            // Response validator is undefined, must NOT have id field
            if (!Object.hasOwn(m, 'id') || isString(m.id)) return false;
        }
        return spec.payload(m.payload);
    }

    return { def, isRequest };
}
