import type { NS } from 'netscript';

import { Client, Message as ClientMessage } from 'util/client';

export const DISPATCH_PORT = 21;
export const DISPATH_RESPONSE_PORT = 22;

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

export interface DaemonRequest<K extends NSMethodName = NSMethodName> {
    /** Dotted method path, e.g. "corporation.createCorporation" */
    method: K;
    /** Exact tuple for the method's args */
    args: NSArgs<K>;
}

export type DaemonResponse<T = unknown> = DaemonOk<T> | DaemonErr;

interface DaemonOk<T = unknown> {
    ok: true;
    value: T;
}

interface DaemonErr {
    ok: false;
    error: string;
}

export enum MessageType {
    Dispatch,
}

export type Message = ClientMessage<MessageType, DaemonRequest>;

export class DispatchClient extends Client<
    MessageType,
    DaemonRequest,
    DaemonResponse
> {
    constructor(ns: NS) {
        super(ns, DISPATCH_PORT, DISPATH_RESPONSE_PORT);
    }

    async dispatch<K extends NSMethodName>(
        methodName: K,
        ...args: NSArgs<K>
    ): Promise<NSReturn<K>> {
        const req: DaemonRequest<K> = { method: methodName, args };
        const res = (await this.sendMessageReceiveResponse(
            null,
            req,
        )) as DaemonResponse<NSReturn<K>>;

        if (!res || typeof res !== 'object')
            throw new Error('Malformed daemon response');
        if (!('ok' in res)) throw new Error('Unrecognized daemon response');

        if (res.ok) return res.value;
        else throw new Error((res as DaemonErr).error);
    }
}
