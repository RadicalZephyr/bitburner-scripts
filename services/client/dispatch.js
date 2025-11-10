import { BaseClient, defineProtocol } from 'util/protocol';
import { isAny, isArrayUnknown, isError, isLiteral, isObjectLike, isString, isUnionOf, } from 'util/validate';
export const DISPATCH_PORT = 21;
export const DISPATCH_RESPONSE_PORT = 22;
const isDispatchRequest = isObjectLike({
    method: isString,
    args: isArrayUnknown,
});
const isDispatchResponseOk = isObjectLike({
    ok: isLiteral(true),
    value: isAny,
});
const isDispatchResponseErr = isObjectLike({
    ok: isLiteral(false),
    error: isError,
});
const isDispatchResponse = isUnionOf(isDispatchResponseOk, isDispatchResponseErr);
export const MessageType = {
    Dispatch: 'NS_Dispatch',
};
export const DispatchProtocol = defineProtocol({
    [MessageType.Dispatch]: {
        payload: isDispatchRequest,
        response: isDispatchResponse,
    },
});
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
    #ns;
    #client;
    constructor(ns) {
        this.#ns = ns;
        this.#client = new BaseClient(DispatchProtocol, ns.getPortHandle(DISPATCH_PORT), ns.getPortHandle(DISPATCH_RESPONSE_PORT));
    }
    /**
     * Convenience wrapper for making usage of `dispatch` more concise.
     *
     * @remarks
     *
     * I usually bind this to `_ns` like this:
     *
     * @example
     *
     * ```ts
     * const dispatchClient = new DispatchClient(ns);
     * const _ns = dispatchClient.asNs();
     *
     * const s = await _ns('getServer', 'n00dles');
     * ```
     */
    asNs() {
        return this.dispatch.bind(this);
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
    async dispatch(methodName, ...args) {
        const req = { method: methodName, args };
        // Zero RAM cost functions can be called in the current process!
        if (this.#ns.getFunctionRamCost(methodName) === 0) {
            return callNsFn(this.#ns, methodName, args);
        }
        const res = (await this.#client.sendMessageReceiveResponse(MessageType.Dispatch, req));
        // NOTE: This lint is spurious, sendMessageReceiveResponse
        // validates the shape of the return type.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        if (res.ok)
            return res.value;
        else
            throw new Error(`Dispatch daemon errored while processing request: ${String(res.error)}`, { cause: res.error });
    }
}
/**
 * Call a Netscript API method by string name.
 *
 * @param ns      - Netscript API instance
 * @param _method - Fully-qualified NS method name, excluding the leading `ns.`
 * @param _args   - Array of arguments to pass to the method
 * @returns Whatever the return value of the called method is
 */
export async function callNsFn(ns, _method, _args) {
    const method = _method.trim();
    if (!method)
        throw new Error('Empty method name');
    const parts = method.split('.');
    if (parts.length === 0)
        throw new Error('Malformed method path');
    let ctx = ns;
    for (let i = 0; i < parts.length - 1; i++) {
        const seg = parts[i];
        if (ctx == null || !Object.hasOwn(ctx, seg)) {
            throw new Error(`Unknown namespace: ${parts.slice(0, i + 1).join('.')}`);
        }
        ctx = ctx[seg];
    }
    const fnName = parts[parts.length - 1];
    const candidate = ctx?.[fnName];
    if (typeof candidate !== 'function') {
        throw new Error(`NS method not found or not callable: ${method}`);
    }
    const args = _args.map((a) => JSON.stringify(a)).join(', ');
    try {
        ns.print(`calling ns.${method}(${args})`);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return (await candidate.apply(ctx, _args));
    }
    catch (e) {
        throw new Error(`${method}(${args})`, { cause: e });
    }
}
