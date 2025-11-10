import { readAllFromPort } from 'util/ports';
import { sleep } from 'util/time';
import { isUnionOf, isError, isLiteral, isNull, isObjectLike, isOptional, isString, isUndefined, isDefined, } from 'util/validate';
export const isRequestUnknown = isObjectLike({
    type: isString,
    id: isOptional(isString),
    payload: isDefined,
});
export const isResponseOkUnknown = isObjectLike({
    type: isString,
    id: isString,
    ok: isLiteral(true),
    payload: isDefined,
});
export const isResponseErrUnknown = isObjectLike({
    type: isString,
    id: isString,
    ok: isLiteral(false),
    error: isError,
});
export const isResponseUnknown = isUnionOf(isResponseOkUnknown, isResponseErrUnknown);
/*---------------- Protocol Error ----------------*/
export class ProtocolError extends Error {
}
export function defineProtocol(def) {
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
    function isRequest(m) {
        if (!types.has(m.type))
            return false;
        const spec = def[m.type];
        if (!spec || typeof spec.payload !== 'function')
            return false;
        if (spec.response) {
            // Response validator is defined, must have id field
            if (!isString(m.id))
                return false;
        }
        else {
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
    function trySendMessage(sendPort, type, payload) {
        const spec = def[type];
        if (spec?.response) {
            throw new ProtocolError(`Protocol misuse: message type ${String(type)} expects a response. `
                + `Use sendMessageReceiveResponse(...) instead.`);
        }
        const message = {
            type,
            id: null,
            payload,
        };
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
    async function sendMessage(sendPort, type, payload, pollPeriodMs) {
        const spec = def[type];
        if (spec?.response) {
            throw new ProtocolError(`Protocol misuse: message type ${String(type)} expects a response. `
                + `Use sendMessageReceiveResponse(...) instead.`);
        }
        const _pollPeriod = Math.max(pollPeriodMs ?? 100, 10);
        const message = {
            type,
            id: null,
            payload,
        };
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
    async function sendMessageReceiveResponse(sendPort, receivePort, type, payload, opts) {
        const spec = def[type];
        if (!spec?.response) {
            throw new ProtocolError(`Protocol misuse: message type ${String(type)} declares no response. `
                + `Use trySendMessage or sendMessage instead.`);
        }
        const _pollPeriod = Math.max(opts?.pollPeriodMs ?? 100, 10);
        const _overallTimeoutMs = Math.max(opts?.overallTimeoutMs ?? 30_000, _pollPeriod);
        const makeReqId = getRequestId(opts?.makeReqId);
        const message = {
            type,
            id: makeReqId(),
            payload,
        };
        while (!sendPort.tryWrite(message)) {
            await sleep(_pollPeriod);
        }
        let warned = false;
        const deadline = Date.now() + _overallTimeoutMs;
        while (true) {
            const peeked = receivePort.peek();
            if (!warned && Date.now() > deadline) {
                console.warn(`Timeout waiting for response: type=${String(type)} id=${message.id}`, peeked);
                warned = true;
            }
            if (isResponseUnknown(peeked)
                && peeked.id === message.id
                && peeked.type === type) {
                // We've identified our response, remove it from the
                // port so other clients can proceed.
                receivePort.read();
                if (isResponseOkUnknown(peeked)) {
                    const validator = spec.response;
                    if (validator && !validator(peeked.payload)) {
                        const err = new ProtocolError(`Invalid response payload for type=${String(type)} id=${message.id}: failed protocol validator`, {
                            cause: {
                                request: payload,
                                response: peeked.payload,
                            },
                        });
                        console.error(err);
                        throw err;
                    }
                    return peeked.payload;
                }
                else if (isResponseErrUnknown(peeked)) {
                    throw new ProtocolError(`Server returned an error for type=${String(type)} id=${message.id}`, { cause: peeked.error });
                }
                else {
                    throw new ProtocolError(`Impossible error in protocol client!`, { cause: peeked });
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
/**
 * Client class for building custom client methods on top of a
 * `Protocol`.
 */
export class BaseClient {
    #protocol;
    #requestPort;
    #responsePort;
    constructor(protocol, requestPort, responsePort) {
        this.#protocol = protocol;
        this.#requestPort = requestPort;
        this.#responsePort = responsePort;
    }
    trySendMessage(type, payload) {
        return this.#protocol.trySendMessage(this.#requestPort, type, payload);
    }
    async sendMessage(type, payload, pollPeriod) {
        return await this.#protocol.sendMessage(this.#requestPort, type, payload, pollPeriod);
    }
    async sendMessageReceiveResponse(type, payload, opts) {
        return await this.#protocol.sendMessageReceiveResponse(this.#requestPort, this.#responsePort, type, payload, opts);
    }
}
export class BaseServer {
    #ns;
    #protocol;
    #requestPort;
    #responsePort;
    #handlers;
    constructor(ns, protocol, requestPort, responsePort, handlers) {
        this.#ns = ns;
        this.#protocol = protocol;
        this.#requestPort = requestPort;
        this.#responsePort = responsePort;
        this.#handlers = handlers;
    }
    async readLoop() {
        // Clear the response port to get rid of stale responses
        if (this.#responsePort)
            this.#responsePort.clear();
        const makeReqId = getRequestId();
        // A tiny "Deferred" exit signal we can resolve from atExit
        let resolveExit;
        const exit = new Promise((r) => {
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
            if (!running)
                break;
            // If a write landed during readFn() (or was already queued), don’t sleep
            if (!this.#requestPort.empty())
                continue;
            await Promise.race([nextWrite, exit]);
        }
    }
    async readFn() {
        for (const msg of readAllFromPort(this.#requestPort)) {
            if (!isRequestUnknown(msg)) {
                this.#ns.print(`WARN: received unexpected request envelope: ${JSON.stringify(msg)}`);
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
                    };
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
                throw new Error(`missing handler for message type ${String(msg.type)}`);
            }
            let responsePayload;
            try {
                responsePayload = await handler(msg.payload);
            }
            catch (err) {
                const cause = {
                    request: msg.payload,
                    error: err,
                };
                const error = err instanceof Error
                    ? new Error('Handler error', { cause })
                    : new Error(`Handler error: ${String(err)}`, { cause });
                if (this.#responsePort && typeof msg.id === 'string') {
                    const response = {
                        id: msg.id,
                        type: msg.type,
                        ok: false,
                        error,
                    };
                    // Send response
                    while (!this.#responsePort.tryWrite(response)) {
                        await sleep(20);
                    }
                }
                else {
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
                };
                // Send response
                while (!this.#responsePort.tryWrite(response)) {
                    await sleep(20);
                }
            }
        }
    }
}
function getRequestId(makeReqId) {
    if (typeof makeReqId === 'function')
        return makeReqId;
    if (typeof crypto?.randomUUID === 'function')
        return crypto.randomUUID.bind(crypto);
    return () => {
        const r1 = Math.floor(Math.random() * 1e9);
        const ts = Date.now();
        const r2 = Math.floor(Math.random() * 1e9);
        return `${r1.toString(36)}-${ts.toString(36)}-${r2.toString(36)}`;
    };
}
