import type { NS } from 'netscript';

import { AnyRequest, BaseClient, defineProtocol } from 'util/protocol';
import {
    Validator,
    isAny,
    isArrayUnknown,
    isError,
    isLiteral,
    isObjectLike,
    isString,
    isUnionOf,
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
    value: isAny,
});

interface DispatchResponseErr {
    ok: false;
    error: Error;
}

const isDispatchResponseErr: Validator<DispatchResponseErr> = isObjectLike({
    ok: isLiteral(false),
    error: isError,
});

export type DispatchResponse<T = unknown> =
    | DispatchResponseOk<T>
    | DispatchResponseErr;

const isDispatchResponse: Validator<DispatchResponse> = isUnionOf(
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
 *
 * The dispatcher executes Netscript APIs in a temporary background process so
 * the caller does not pay the target function's RAM cost.
 *
 * Advantages:
 * - Expensive APIs can be used without their RAM cost in the calling script.
 *
 * Disadvantages:
 * - Each request spawns an additional process which adds latency and requires free RAM.
 * - Calls are rejected when the function's RAM cost exceeds `SERVICE_maxNsFnRam`.
 *
 * @remarks
 * The ideal use-case for the `DispatchClient` is for infrequent calls
 * to NS APIs that have very high RAM costs, such as the Corporation
 * API, or the Gang initialization APIs.
 *
 * Usage of the `DispatchClient` and the regular `NS` API instance can
 * be mixed freely.
 *
 * Any Netscript functions that have zero RAM cost will not be sent to
 * the dispatch executor process, instead they will be immediately
 * invoked in the current process.
 *
 * WARNING:
 * All Netscript APIs are awaited to completion, so calling any
 * Netscript API that blocks for long periods of time will cause the
 * executor process to block until the promise resolves!
 *
 * @example
 * ```ts
 * const _ns = new DispatchClient(ns);
 * const server = await _ns.dispatch('getServer', 'n00dles');
 * ```
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
        const req: DispatchRequest<K> = { method: methodName, args };
        // Zero RAM cost functions can be called in the current process!
        if (this.#ns.getFunctionRamCost(methodName) === 0) {
            return callNsFn(this.#ns, methodName, args);
        }

        const res = (await this.#client.sendMessageReceiveResponse(
            MessageType.Dispatch,
            req,
        )) as DispatchResponse<NSReturn<K>>;

        if (res.ok) return res.value;
        else
            throw new Error(
                `Dispatch daemon errored while processing request: ${String((res as DispatchResponseErr).error)}`,
                { cause: (res as DispatchResponseErr).error },
            );
    }
}

export type DispatchFn = <K extends NSMethodName>(
    methodName: K,
    ...args: NSArgs<K>
) => Promise<NSReturn<K>>;

/**
 * Call a Netscript API method by string name.
 *
 * @param ns      - Netscript API instance
 * @param _method - Fully-qualified NS method name, excluding the leading `ns.`
 * @param _args   - Array of arguments to pass to the method
 * @returns Whatever the return value of the called method is
 */
export async function callNsFn<K extends NSMethodName = NSMethodName>(
    ns: NS,
    _method: K,
    _args: NSArgs<K>,
): Promise<NSReturn<K>> {
    const method = _method.trim();
    if (!method) throw new Error('Empty method name');

    const parts = method.split('.');
    if (parts.length === 0) throw new Error('Malformed method path');

    let ctx: unknown = ns;
    for (let i = 0; i < parts.length - 1; i++) {
        const seg = parts[i];
        if (ctx == null || !Object.hasOwn(ctx as object, seg)) {
            throw new Error(
                `Unknown namespace: ${parts.slice(0, i + 1).join('.')}`,
            );
        }
        ctx = (ctx as Record<string, unknown>)[seg];
    }

    const fnName = parts[parts.length - 1]!;
    const candidate = (ctx as Record<string, unknown>)?.[fnName];

    if (typeof candidate !== 'function') {
        throw new Error(`NS method not found or not callable: ${method}`);
    }

    const args = _args.map((a) => JSON.stringify(a)).join(', ');
    try {
        ns.print(`calling ns.${method}(${args})`);
        return await (candidate as (...a: unknown[]) => unknown).apply(
            ctx,
            _args,
        );
    } catch (e) {
        const msg = e?.message ?? String(e);
        throw new Error(`${method}(${args}) failed: ${msg}`, { cause: e });
    }
}
