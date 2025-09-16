import { NetscriptPort } from '@ns';

import { ServerNS } from 'util/ns';
import { readAllFromPort } from 'util/ports';
import { sleep } from 'util/time';
import {
    isUnionOf,
    isError,
    isLiteral,
    isNull,
    isObjectLike,
    isOptional,
    isString,
    isUndefined,
    isDefined,
    type Validator,
} from 'util/validate';

/*---------------- Options Interfaces ----------------*/

export type MakeReqId = () => string;

export interface SendWithResponseOptions {
    /** How often to poll while a foreign head is blocking. Default: 100ms */
    pollPeriodMs?: number;

    /** Overall timeout since we sent our request. Default: 30s */
    overallTimeoutMs?: number;

    /**
     * Request ID factory function.
     *
     * @returns A (fairly) unique request id every time it's called.
     */
    makeReqId: MakeReqId;
}

/*---------------- Protocol Envelopes ----------------*/

export interface RequestEnvelope<T, I, R> {
    type: T;
    id?: I;
    payload: R;
}

export type RequestUnknown = RequestEnvelope<unknown, string | null, unknown>;

export const isRequestUnknown: Validator<RequestUnknown> = isObjectLike({
    type: isDefined,
    id: isOptional(isString),
    payload: isDefined,
});

export interface ResponseOkEnvelope<T, R> {
    type: T;
    id: string;
    ok: true;
    payload: R;
}

export interface ResponseErrEnvelope<T> {
    type: T;
    id: string;
    ok: false;
    error: Error;
}

export type ResponseEnvelope<T, R> =
    | ResponseOkEnvelope<T, R>
    | ResponseErrEnvelope<T>;

export type ResponseOkUnknown = ResponseOkEnvelope<unknown, unknown>;

export type ResponseErrUnknown = ResponseErrEnvelope<unknown>;

export type ResponseUnknown = ResponseEnvelope<unknown, unknown>;

export const isResponseOkUnknown: Validator<ResponseOkUnknown> = isObjectLike({
    type: isString,
    id: isString,
    ok: isLiteral(true),
    payload: isDefined,
});

export const isResponseErrUnknown: Validator<ResponseErrUnknown> = isObjectLike(
    {
        type: isString,
        id: isString,
        ok: isLiteral(false),
        error: isError,
    },
);

export const isResponseUnknown = isUnionOf(
    isResponseOkUnknown,
    isResponseErrUnknown,
);

/*---------------- Protocol Error ----------------*/

export class ProtocolError extends Error {}

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

type KeysWithResponse<P extends ProtocolDef> = {
    [K in keyof P]-?: P[K] extends { response: Validator<unknown> } ? K : never;
}[keyof P];

type KeysWithoutResponse<P extends ProtocolDef> = Exclude<
    keyof P,
    KeysWithResponse<P>
>;

type IdOf<P extends ProtocolDef, K extends keyof P> =
    K extends KeysWithResponse<P> ? string : null;

type PayloadOf<P extends ProtocolDef, K extends keyof P> = P[K] extends {
    payload: Validator<infer A>;
}
    ? A
    : never;

type ResponseOf<P extends ProtocolDef, K extends keyof P> = P[K] extends {
    response: Validator<infer R>;
}
    ? R
    : void;

export type AnyRequest<P extends ProtocolDef> = {
    [K in keyof P]: RequestEnvelope<K, IdOf<P, K>, PayloadOf<P, K>>;
}[keyof P];

export function defineProtocol<const P extends ProtocolDef>(def: P) {
    const types = new Set(Object.keys(def));

    /**
     * Type predicate for checking if a Request is valid.
     *
     * @remarks
     * - Message types with no response validator _must_ have a null/undefined id field.
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
            // Response validator is undefined, must NOT have a non-null id field
            if (Object.hasOwn(m, 'id') && !(isNull(m.id) || isUndefined(m.id)))
                return false;
        }
        return spec.payload(m.payload);
    }

    /**
     * Attempt to queue a message to a port without waiting for space.
     *
     * @param sendPort - Netscript Port to send messages on
     * @param type     - Message type tag
     * @param payload  - Message payload
     */
    function trySendMessage<K extends KeysWithoutResponse<P>>(
        sendPort: NetscriptPort,
        type: K,
        payload: PayloadOf<P, K>,
    ): boolean {
        const spec = def[type];
        if (spec?.response) {
            throw new ProtocolError(
                `Protocol misuse: message type ${String(type)} expects a response. `
                    + `Use sendMessageReceiveResponse(...) instead.`,
            );
        }

        const message = {
            type,
            id: null,
            payload,
        } satisfies RequestEnvelope<K, null, PayloadOf<P, K>>;
        return sendPort.tryWrite(message);
    }

    /**
     * Send a message to a server without waiting for a response.
     *
     * @remarks
     * This method waits for the port to have space to accept the message.
     *
     * @param sendPort     - Netscript Port to send messages on
     * @param type         - Message type tag
     * @param payload      - Message payload
     * @param pollPeriodMs - Period to wait between attempts to send message
     */
    async function sendMessage<K extends KeysWithoutResponse<P>>(
        sendPort: NetscriptPort,
        type: K,
        payload: PayloadOf<P, K>,
        pollPeriodMs?: number,
    ): Promise<void> {
        const spec = def[type];
        if (spec?.response) {
            throw new ProtocolError(
                `Protocol misuse: message type ${String(type)} expects a response. `
                    + `Use sendMessageReceiveResponse(...) instead.`,
            );
        }

        const _pollPeriod = Math.max(pollPeriodMs ?? 100, 10);
        const message = {
            type,
            id: null,
            payload,
        } satisfies RequestEnvelope<K, null, PayloadOf<P, K>>;
        while (!sendPort.tryWrite(message)) {
            await sleep(_pollPeriod);
        }
    }

    /**
     * Send a message type and payload to a server and wait for a response.
     *
     * @param sendPort    - Netscript Port to send messages on
     * @param receivePort - Netscript Port to receive messages on
     * @param type        - Message type tag
     * @param payload     - Message payload
     * @param opts        - Sending options
     * @returns Response from server
     */
    async function sendMessageReceiveResponse<K extends KeysWithResponse<P>>(
        sendPort: NetscriptPort,
        receivePort: NetscriptPort,
        type: K,
        payload: PayloadOf<P, K>,
        opts?: SendWithResponseOptions,
    ): Promise<ResponseOf<P, K>> {
        const spec = def[type];
        if (!spec?.response) {
            throw new ProtocolError(
                `Protocol misuse: message type ${String(type)} declares no response. `
                    + `Use trySendMessage or sendMessage instead.`,
            );
        }

        const _pollPeriod = Math.max(opts?.pollPeriodMs ?? 100, 10);
        const _overallTimeoutMs = Math.max(
            opts?.overallTimeoutMs ?? 30_000,
            _pollPeriod,
        );
        const makeReqId = getRequestId(opts?.makeReqId);

        const message = {
            type,
            id: makeReqId(),
            payload,
        } satisfies RequestEnvelope<K, string, PayloadOf<P, K>>;

        while (!sendPort.tryWrite(message)) {
            await sleep(_pollPeriod);
        }

        let warned = false;
        const deadline = Date.now() + _overallTimeoutMs;

        while (true) {
            const peeked = receivePort.peek() as unknown;
            if (!warned && Date.now() > deadline) {
                console.warn(
                    `Timeout waiting for response: type=${String(type)} id=${message.id}`,
                    peeked,
                );
                warned = true;
            }

            if (
                isResponseUnknown(peeked)
                && peeked.id === message.id
                && peeked.type === type
            ) {
                // We've identified our response, remove it from the
                // port so other clients can proceed.
                receivePort.read();

                if (isResponseOkUnknown(peeked)) {
                    const validator = spec.response as Validator<
                        ResponseOf<P, K>
                    >;
                    if (validator && !validator(peeked.payload)) {
                        const err = new ProtocolError(
                            `Invalid response payload for type=${String(type)} id=${message.id}: failed protocol validator`,
                            {
                                cause: {
                                    request: payload,
                                    response: peeked.payload,
                                },
                            },
                        );
                        console.error(err);
                        throw err;
                    }
                    return peeked.payload as ResponseOf<P, K>;
                } else if (isResponseErrUnknown(peeked)) {
                    throw new ProtocolError(
                        `Server returned an error for type=${String(type)} id=${message.id}`,
                        { cause: peeked.error },
                    );
                } else {
                    throw new ProtocolError(
                        `Impossible error in protocol client!`,
                        { cause: peeked },
                    );
                }
            }

            await sleep(_pollPeriod);
        }
    }

    return {
        def,
        isRequest,
        trySendMessage,
        sendMessage,
        sendMessageReceiveResponse,
    };
}

export type Protocol<P extends ProtocolDef> = ReturnType<
    typeof defineProtocol<P>
>;

/**
 * Client class for building custom client methods on top of a
 * `Protocol`.
 */
export class BaseClient<P extends ProtocolDef> {
    #protocol: Protocol<P>;
    #requestPort: NetscriptPort;
    #responsePort: NetscriptPort;

    constructor(
        protocol: Protocol<P>,
        requestPort: NetscriptPort,
        responsePort: NetscriptPort,
    ) {
        this.#protocol = protocol;
        this.#requestPort = requestPort;
        this.#responsePort = responsePort;
    }

    trySendMessage<K extends KeysWithoutResponse<P>>(
        type: K,
        payload: PayloadOf<P, K>,
    ): boolean {
        return this.#protocol.trySendMessage(this.#requestPort, type, payload);
    }

    async sendMessage<K extends KeysWithoutResponse<P>>(
        type: K,
        payload: PayloadOf<P, K>,
        pollPeriod?: number,
    ): Promise<void> {
        return await this.#protocol.sendMessage(
            this.#requestPort,
            type,
            payload,
            pollPeriod,
        );
    }

    async sendMessageReceiveResponse<K extends KeysWithResponse<P>>(
        type: K,
        payload: PayloadOf<P, K>,
        opts?: SendWithResponseOptions,
    ): Promise<ResponseOf<P, K>> {
        return await this.#protocol.sendMessageReceiveResponse(
            this.#requestPort,
            this.#responsePort,
            type,
            payload,
            opts,
        );
    }
}

export type Handlers<P extends ProtocolDef> = {
    [K in keyof P]: (payload: PayloadOf<P, K>) => Promise<ResponseOf<P, K>>;
};

export class BaseServer<P extends ProtocolDef> {
    #ns: ServerNS;
    #protocol: Protocol<P>;
    #requestPort: NetscriptPort;
    #responsePort: NetscriptPort;
    #handlers: Handlers<P>;

    constructor(
        ns: ServerNS,
        protocol: Protocol<P>,
        requestPort: NetscriptPort,
        responsePort: NetscriptPort,
        handlers: Handlers<P>,
    ) {
        this.#ns = ns;
        this.#protocol = protocol;
        this.#requestPort = requestPort;
        this.#responsePort = responsePort;
        this.#handlers = handlers;
    }

    async readLoop() {
        // Clear the response port to get rid of stale responses
        if (this.#responsePort) this.#responsePort.clear();

        const makeReqId = getRequestId(null);

        // A tiny "Deferred" exit signal we can resolve from atExit
        let resolveExit!: () => void;
        const exit = new Promise<void>((r) => {
            resolveExit = r;
        });

        let running = true;
        this.#ns.atExit(() => {
            running = false;
            resolveExit();
        }, `readLoop-${makeReqId()}`);

        while (running) {
            const nextWrite = this.#requestPort.nextWrite();
            await this.readFn();

            if (!running) break;

            // If a write landed during readFn() (or was already queued), don’t sleep
            if (!this.#requestPort.empty()) continue;

            await Promise.race([nextWrite, exit]);
        }
    }

    async readFn() {
        for (const msg of readAllFromPort(this.#requestPort)) {
            if (!isRequestUnknown(msg)) {
                this.#ns.print(
                    `WARN: received unexpected request envelope: ${JSON.stringify(msg)}`,
                );
                continue;
            }

            if (!this.#protocol.isRequest(msg)) {
                const errorMsg = `ERROR: received unknown message type: '${msg.type}' with payload: ${JSON.stringify(msg.payload)}`;
                this.#ns.print(errorMsg);
                if (this.#responsePort && typeof msg.id === 'string') {
                    const response = {
                        id: msg.id,
                        type: msg.type,
                        ok: false,
                        error: new ProtocolError(errorMsg, { cause: msg }),
                    } satisfies ResponseErrUnknown;

                    // Send response
                    while (!this.#responsePort.tryWrite(response)) {
                        await sleep(20);
                    }
                }

                continue;
            }

            const handler = this.#handlers[msg.type];
            if (!handler || typeof handler !== 'function') {
                // throw an error because a missing handler is a server definition error
                throw new Error(
                    `missing handler for message type ${String(msg.type)}`,
                );
            }

            let responsePayload: Awaited<ResponseOf<P, keyof P>> | undefined;

            try {
                responsePayload = await handler(msg.payload);
            } catch (err) {
                const cause = {
                    request: msg.payload,
                    error: err,
                };

                const error =
                    err instanceof Error
                        ? new Error('Handler error', { cause })
                        : new Error(`Handler error: ${String(err)}`, { cause });

                if (this.#responsePort && typeof msg.id === 'string') {
                    const response = {
                        id: msg.id,
                        type: msg.type,
                        ok: false,
                        error,
                    } as ResponseErrUnknown;

                    // Send response
                    while (!this.#responsePort.tryWrite(response)) {
                        await sleep(20);
                    }
                } else {
                    console.error(error);
                }
                continue;
            }

            if (this.#responsePort && typeof msg.id === 'string') {
                const response = {
                    id: msg.id,
                    type: msg.type,
                    ok: true,
                    request: msg.payload,
                    payload: responsePayload,
                } as ResponseOkUnknown;

                // Send response
                while (!this.#responsePort.tryWrite(response)) {
                    await sleep(20);
                }
            }
        }
    }
}

function getRequestId(makeReqId: MakeReqId): MakeReqId {
    if (typeof makeReqId === 'function') return makeReqId;
    if (typeof crypto?.randomUUID === 'function')
        return crypto.randomUUID.bind(crypto);
    return () => {
        const r1 = Math.floor(Math.random() * 1e9);
        const ts = Date.now();
        const r2 = Math.floor(Math.random() * 1e9);
        return `${r1.toString(36)}-${ts.toString(36)}-${r2.toString(36)}`;
    };
}
