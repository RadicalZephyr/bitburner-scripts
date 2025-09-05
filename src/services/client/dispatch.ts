import type { NS } from 'netscript';

import { AnyRequest, BaseClient, defineProtocol } from 'util/protocol';
import {
    Validator,
    isAnyOf,
    isArrayUnknown,
    isDefined,
    isLiteral,
    isObjectLike,
    isString,
} from 'util/validate';

export const DISPATCH_PORT = 21;
export const DISPATCH_RESPONSE_PORT = 22;

// ---- Type utilities (types-only; erased at runtime) ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fn = (...args: any) => any;
type Join<L extends string, R extends string> = `${L}.${R}`;

// All dotted paths where the leaf is a function
type FnPaths<T> = {
    [K in keyof T & string]: T[K] extends Fn
        ? K
        : T[K] extends object
          ? Join<K, FnPaths<T[K]>>
          : never;
}[keyof T & string];

// Get the type at a dotted path
type PathValue<T, P extends string> = P extends `${infer K}.${infer Rest}`
    ? K extends keyof T
        ? PathValue<T[K], Rest>
        : never
    : P extends keyof T
      ? T[P]
      : never;

type ExtractFn<T> = T extends Fn ? T : never;

// ---- Public types you’ll use ----
export type NSMethodName = FnPaths<NS>;
export type NSArgs<K extends NSMethodName> = Parameters<
    ExtractFn<PathValue<NS, K>>
>;
export type NSReturn<K extends NSMethodName> = ReturnType<
    ExtractFn<PathValue<NS, K>>
>;

export interface DispatchRequest<K extends NSMethodName = NSMethodName> {
    /** Dotted method path, e.g. "corporation.createCorporation" */
    method: K;
    /** Exact tuple for the method's args */
    args: NSArgs<K>;
}

const isDispatchRequest: Validator<DispatchRequest> = isObjectLike({
    method: isString as Validator<NSMethodName>,
    args: isArrayUnknown,
});

interface DispatchResponseOk<T = unknown> {
    ok: true;
    value: T;
}

const isDispatchResponseOk: Validator<DispatchResponseOk> = isObjectLike({
    ok: isLiteral(true),
    value: isDefined,
});

interface DispatchResponseErr {
    ok: false;
    error: string;
}

const isDispatchResponseErr: Validator<DispatchResponseErr> = isObjectLike({
    ok: isLiteral(false),
    error: isString,
});

export type DispatchResponse<T = unknown> =
    | DispatchResponseOk<T>
    | DispatchResponseErr;

const isDispatchResponse: Validator<DispatchResponse> = isAnyOf(
    isDispatchResponseOk,
    isDispatchResponseErr,
);

export const MessageType = {
    Dispatch: 'NS_Dispatch',
} as const;

export const DispatchProtocol = defineProtocol({
    [MessageType.Dispatch]: {
        payload: isDispatchRequest,
        response: isDispatchResponse,
    },
});

export type DispatchProtocolDef = (typeof DispatchProtocol)['def'];

export type Message = AnyRequest<DispatchProtocolDef>;

/**
 * Client for the Netscript Dispatch service.
 */
export class DispatchClient {
    #ns: NS;
    #client: BaseClient<DispatchProtocolDef>;

    constructor(ns: NS) {
        this.#ns = ns;
        this.#client = new BaseClient(
            DispatchProtocol,
            ns.getPortHandle(DISPATCH_PORT),
            ns.getPortHandle(DISPATCH_RESPONSE_PORT),
        );
    }

    /**
     * Call a Netscript API in an ephemeral process and receive the result.
     *
     * @param methodName - Netscript API method path and name
     * @param args       - Arguments for the Netscript API function in `methodName`
     * @returns Whatever the API returns.
     *
     * @throws Promise rejects if `methodName` is not a valid Netscript API or if it throws an error.
     */
    async dispatch<K extends NSMethodName>(
        methodName: K,
        ...args: NSArgs<K>
    ): Promise<NSReturn<K>> {
        if (!this.#ns.getFunctionRamCost(methodName))
            throw new Error(`${methodName} is not a valid Netscript function!`);

        const req: DispatchRequest<K> = { method: methodName, args };
        const res = (await this.#client.sendMessageReceiveResponse(
            MessageType.Dispatch,
            req,
        )) as DispatchResponse<NSReturn<K>>;

        if (!res || typeof res !== 'object')
            throw new Error('Malformed daemon response');
        if (!('ok' in res)) throw new Error('Unrecognized daemon response');

        if (res.ok) return res.value;
        else
            throw new Error(
                'Dispatch daemon errored while processing request',
                { cause: (res as DispatchResponseErr).error },
            );
    }
}
