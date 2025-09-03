import { describe, expect, jest, test } from '@jest/globals';

import { ServerNS } from '../ns';

import {
    isArrayUnknown,
    isBigInt,
    isBoolean,
    isRequestUnknown,
    isNull,
    isNumber,
    isObjectUnknown,
    isResponseUnknown,
    isString,
    isUndefined,
    makeIsArray,
    type ProtocolDef,
    type Validator,
    defineProtocol,
    BaseClient,
    BaseServer,
    Handlers,
    ProtocolError,
    RequestUnknown,
    ResponseErrUnknown,
} from '../protocol';

import { createAtExitFixture } from '../../test_util/nsAtExitFixture';
import {
    createPortsFixture,
    MockNetscriptPort,
} from '../../test_util/nsPortFixture';
import { createPrintFixture } from '../../test_util/nsPrintFixture';

async function expectPendingNow<T>(p: Promise<T>) {
    const sentinel = Symbol('pending');
    const winner = await Promise.race([p, Promise.resolve(sentinel)]);
    expect(winner).toBe(sentinel);
}

describe('our protocol abstraction', () => {
    test('is based on Validator functions', () => {
        const isValid = ((o: unknown): o is object => {
            return typeof o === 'object' && o !== null;
        }) satisfies Validator<object>;

        expect(isValid({})).toBeTruthy();

        expect(isValid(undefined)).toBeFalsy();
        expect(isValid(null)).toBeFalsy();
        expect(isValid(1)).toBeFalsy();
        expect(isValid(1n)).toBeFalsy();
        expect(isValid('thing')).toBeFalsy();
    });

    describe('core JS type validator functions are provided', () => {
        test.each([
            ['undefined', isUndefined, undefined, null],
            ['null', isNull, null, undefined],
            ['boolean', isBoolean, false, null],
            ['number', isNumber, 0, 'hello'],
            ['bigint', isBigInt, 0n, undefined],
            ['string', isString, '', 3],
            ['array of unknown', isArrayUnknown, [], null],
            ['array of T', makeIsArray(isNumber), [0, 1, 2], ['', 2, null]],
            ['object', isObjectUnknown, {}, null],
        ])('%s validator', (type, validate, valid, invalid) => {
            expect(validate(valid)).toBeTruthy();
            expect(validate(invalid)).toBeFalsy();
        });
    });
});

describe('protocol definitions map a message type', () => {
    test('to a payload', () => {
        const testProtoType = 'foo';
        const TestProtoDef = {
            [testProtoType]: {
                payload: (v: unknown): v is number => typeof v === 'number',
            },
        } as const satisfies ProtocolDef;

        const validate = TestProtoDef[testProtoType].payload;
        expect(validate(1)).toBeTruthy();
        expect(validate('')).toBeFalsy();
    });

    test('and an optional response', () => {
        const testProtoType = 'foo';
        const TestProtoDef = {
            [testProtoType]: {
                payload: (v: unknown): v is number => typeof v === 'number',
                response: (v: unknown): v is string => typeof v === 'string',
            },
        } as const satisfies ProtocolDef; // todo

        const validate = TestProtoDef[testProtoType].response;
        expect(validate('')).toBeTruthy();
        expect(validate(1)).toBeFalsy();
    });
});

describe('all protocols use common envelopes', () => {
    describe('requests', () => {
        test.each([
            ['with message id', { type: 'foo', id: '', payload: {} }],
            ['with missing message id', { type: 'bar', payload: [] }],
            ['with null message id', { type: 'bar', id: null, payload: [] }],
            [
                'with explicitly undefined message id',
                { type: 'bar', id: undefined, payload: [] },
            ],
        ])('%s are valid', (description, message) => {
            expect(isRequestUnknown(message)).toBeTruthy();
        });

        test.each([
            ['with no type', { id: '', payload: 1 }],
            ['with no payload', { type: 'foo', id: '' }],
        ])('%s are invalid', (description, message) => {
            expect(isRequestUnknown(message)).toBeFalsy();
        });
    });

    describe('responses', () => {
        test('with type, id and payload are valid', () => {
            const response = { type: 'foo', id: '', payload: {}, ok: true };
            expect(isResponseUnknown(response)).toBeTruthy();
        });

        test.each([
            ['with no type', { id: '', ok: true, payload: 1 }],
            ['with no id', { type: 'bar', ok: true, payload: 0n }],
            ['with no ok', { type: 'foo', id: '', payload: 0n }],
        ])('%s are invalid', (description, response) => {
            expect(isResponseUnknown(response)).toBeFalsy();
        });
    });
});

describe('custom protocols create precise request validators', () => {
    const TestProtocol = defineProtocol({
        withNoResponse: {
            payload: isString,
        },

        withResponse: {
            payload: isString,
            response: isBoolean,
        },
    });

    describe('type with no response validator', () => {
        test('is invalid with no id', () => {
            expect(
                TestProtocol.isRequest({
                    type: 'withNoResponse',
                    payload: 'hello protocol',
                } as RequestUnknown),
            ).toBeFalsy();
        });

        test.each([
            ['null', null],
            ['undefined', undefined],
        ])('is valid with %s id', (description, id) => {
            expect(
                TestProtocol.isRequest({
                    type: 'withNoResponse',
                    id,
                    payload: 'hello protocol',
                }),
            ).toBeTruthy();
        });

        test('is invalid with a string id', () => {
            expect(
                TestProtocol.isRequest({
                    type: 'withNoResponse',
                    id: '',
                    payload: 'hello protocol',
                }),
            ).toBeFalsy();
        });
    });

    describe('type with a response validator', () => {
        test('is invalid with no id', () => {
            expect(
                TestProtocol.isRequest({
                    type: 'withResponse',
                    payload: 'hello response',
                } as RequestUnknown),
            ).toBeFalsy();
        });

        test.each([
            ['null', null],
            ['undefined', undefined],
        ])('is invalid with %s id', (description, id) => {
            expect(
                TestProtocol.isRequest({
                    type: 'withResponse',
                    id,
                    payload: 'hello response',
                }),
            ).toBeFalsy();
        });

        test('is valid with a string id', () => {
            expect(
                TestProtocol.isRequest({
                    type: 'withResponse',
                    id: '',
                    payload: 'hello response',
                }),
            ).toBeTruthy();
        });
    });
});

describe('custom protocols define message sending utility functions', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    const TestProtocol = defineProtocol({
        withNoResponse: {
            payload: isString,
        },

        withResponse: {
            payload: isString,
            response: isBoolean,
        },
    });

    function expectWithNoResponse(received: unknown, payload: string) {
        expect(isRequestUnknown(received)).toBeTruthy();
        // We need to cast to RequestUnknown because
        // typescript flow control analysis doesn't recognize
        // Jest expect failing as throwing an error
        const request = received as RequestUnknown;
        expect(TestProtocol.isRequest(request)).toBeTruthy();

        expect(request).toEqual({
            type: 'withNoResponse',
            id: null,
            payload,
        });
    }

    function expectWithResponse(
        received: unknown,
        id: string,
        payload: string,
    ) {
        expect(received).toEqual({
            type: 'withResponse',
            id,
            payload,
        });

        expect(isRequestUnknown(received)).toBeTruthy();
        // We need to cast to RequestUnknown because
        // typescript flow control analysis doesn't recognize
        // Jest expect failing as throwing an error
        const request = received as RequestUnknown;
        expect(TestProtocol.isRequest(request)).toBeTruthy();
    }

    describe('messages with no response must be sent with', () => {
        describe('trySendMessage', () => {
            test('sends messages', () => {
                const sendPort = new MockNetscriptPort(10);
                const sent = TestProtocol.trySendMessage(
                    sendPort,
                    'withNoResponse',
                    'payload',
                );
                expect(sent).toBeTruthy();

                const received = sendPort.read();
                expectWithNoResponse(received, 'payload');
            });

            test('does not always deliver', () => {
                const sendPort = new MockNetscriptPort(1);
                // Fill the port
                sendPort.write({});

                const sent = TestProtocol.trySendMessage(
                    sendPort,
                    'withNoResponse',
                    'payload',
                );
                expect(sent).toBeFalsy();
            });

            test('rejects message types with a response validator', () => {
                const sendPort = new MockNetscriptPort(10);
                expect(() =>
                    TestProtocol.trySendMessage(
                        sendPort,
                        // We have to blatantly lie to tsc to show this fails at runtime too
                        'withResponse' as 'withNoResponse',
                        'payload',
                    ),
                ).toThrow(ProtocolError);
            });
        });

        describe('sendMessage', () => {
            test('sends messages', async () => {
                const sendPort = new MockNetscriptPort(10);
                await TestProtocol.sendMessage(
                    sendPort,
                    'withNoResponse',
                    'payload',
                );

                const received = sendPort.read();
                expectWithNoResponse(received, 'payload');
            });

            test('waits for space before writing to port', async () => {
                const sendPort = new MockNetscriptPort(1);
                // Fill the port
                const sentinel = 'messageSentinel';
                sendPort.write(sentinel);

                const sendFinished = TestProtocol.sendMessage(
                    sendPort,
                    'withNoResponse',
                    'payload',
                );
                await expectPendingNow(sendFinished);

                // Clear space in the port
                const read = sendPort.read();
                expect(read).toBe(sentinel);

                await jest.runAllTimersAsync();

                await expect(sendFinished).resolves.toBeUndefined();

                const received = sendPort.read();
                expectWithNoResponse(received, 'payload');
            });

            test('rejects message types with a response validator', async () => {
                const sendPort = new MockNetscriptPort(10);
                await expect(
                    TestProtocol.sendMessage(
                        sendPort,
                        // We have to blatantly lie to tsc to show this fails at runtime too
                        'withResponse' as 'withNoResponse',
                        'payload',
                    ),
                ).rejects.toThrow(ProtocolError);
            });
        });
    });

    describe('messages with response must be sent with', () => {
        describe('sendMessageReceiveResponse', () => {
            test('sends messages and receives a response', async () => {
                const requestPort = new MockNetscriptPort(10);
                const responsePort = new MockNetscriptPort(10);

                const expectedId = '12-bead-123456';
                const waiter = TestProtocol.sendMessageReceiveResponse(
                    requestPort,
                    responsePort,
                    'withResponse',
                    'payload',
                    {
                        makeReqId: () => expectedId,
                    },
                );

                const request = requestPort.read();
                expectWithResponse(request, expectedId, 'payload');

                await expectPendingNow(waiter);

                responsePort.tryWrite({
                    type: request.type,
                    id: expectedId,
                    ok: true,
                    payload: true,
                });
                jest.runAllTimers();

                await expect(waiter).resolves.toBeTruthy();
            });

            test('sends messages and times out if no response received', async () => {
                const requestPort = new MockNetscriptPort(10);
                const responsePort = new MockNetscriptPort(10);

                const overallTimeoutMs = 100;
                const expectedId = '12-bead-123456';
                const waiter = TestProtocol.sendMessageReceiveResponse(
                    requestPort,
                    responsePort,
                    'withResponse',
                    'payload',
                    {
                        makeReqId: () => expectedId,
                        overallTimeoutMs,
                    },
                );

                const request = requestPort.read();
                expectWithResponse(request, expectedId, 'payload');

                await expectPendingNow(waiter);

                responsePort.tryWrite({
                    type: request.type,
                    id: 'a-different-id',
                    payload: true,
                });

                await expectPendingNow(waiter);

                // Advance timers
                jest.advanceTimersByTime(overallTimeoutMs + 10);

                await expect(waiter).rejects.toThrow(ProtocolError);
            });

            test('rejects message types without a response validator', async () => {
                const requestPort = new MockNetscriptPort(10);
                const responsePort = new MockNetscriptPort(10);

                const responseReceived =
                    TestProtocol.sendMessageReceiveResponse(
                        requestPort,
                        responsePort,
                        // We have to blatantly lie to tsc to show this fails at runtime too
                        'withNoResponse' as 'withResponse',
                        'payload',
                    );
                await expect(responseReceived).rejects.toThrow(ProtocolError);
            });
        });
    });
});

describe('BaseClient and BaseServer provide a higher-level interface to custom protocols', () => {
    //
    // --- NS fixtures ---
    //
    const atExitFixture = createAtExitFixture();
    atExitFixture.hookJest();

    const portsFixture = createPortsFixture();
    portsFixture.hookJest();

    const printFixture = createPrintFixture();
    printFixture.hookJest();

    beforeEach(() => {
        jest.useFakeTimers(); // default; we’ll opt-in to real timers per test where helpful
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    //
    // --- Protocol under test ---
    //
    const TestProtocol = defineProtocol({
        withNoResponse: {
            payload: isString,
        },

        withResponse: {
            payload: isString,
            response: isBigInt,
        },
    });

    type TestProtocolDef = (typeof TestProtocol)['def'];

    const getPortHandle = portsFixture.port;

    class TestClient {
        #client: BaseClient<TestProtocolDef>;

        constructor() {
            const requestPort = getPortHandle(1);
            const responsePort = getPortHandle(2);
            this.#client = new BaseClient(
                TestProtocol,
                requestPort,
                responsePort,
            );
        }

        attempt(payload: string): boolean {
            return this.#client.trySendMessage('withNoResponse', payload);
        }

        async definitelySend(payload: string) {
            await this.#client.sendMessage('withNoResponse', payload);
        }

        async sendAndReceive(payload: string): Promise<bigint> {
            return await this.#client.sendMessageReceiveResponse(
                'withResponse',
                payload,
            );
        }
    }

    const mockWithNoResponse = jest.fn();
    const mockWithResponse = jest.fn((payload: string) =>
        BigInt(payload.length),
    );

    class TestServer extends BaseServer<TestProtocolDef> {
        constructor(ns: ServerNS) {
            const requestPort = getPortHandle(1);
            const responsePort = getPortHandle(2);
            const handlers: Handlers<TestProtocolDef> = {
                withNoResponse: async (payload) => {
                    mockWithNoResponse(payload);
                },
                withResponse: async (payload) => {
                    return mockWithResponse(payload);
                },
            };
            super(ns, TestProtocol, requestPort, responsePort, handlers);
        }
    }

    //
    // Small helpers
    //
    async function microtaskPump(times = 2) {
        for (let i = 0; i < times; i++) await Promise.resolve();
    }

    //
    // --- Tests ---
    //

    describe('unit tests', () => {
        test('server emits error response for structurally-valid but unknown message type', async () => {
            // We bypass client and craft an “unknown type” envelope that passes isRequestUnknown
            const ns = { ...atExitFixture.ns, ...printFixture.ns } as ServerNS;
            const server = new TestServer(ns);

            const reqPort = getPortHandle(1);
            const resPort = getPortHandle(2);

            // This shape should match your “unknown request” envelope that the server recognizes
            const unknownReq = {
                id: 'abc-123',
                type: 'noSuchType', // not in TestProtocol
                payload: 'whatever',
            };

            // Write unknown request to the request port
            reqPort.write(unknownReq);

            // Run a single read cycle deterministically
            await server.readFn();

            // The server prints an error and writes an error response
            // (response shape follows ResponseErrUnknown)
            // Pull whatever the first response is
            const resp = resPort.read();
            expect(resp && typeof resp === 'object' && 'ok' in resp).toBe(true);

            const respUnknown = resp as ResponseErrUnknown;
            expect(respUnknown.ok).toBeFalsy();
            expect(respUnknown.id).toBe('abc-123');
            expect(respUnknown.type).toBe('noSuchType');

            // Also confirm a diagnostic was printed
            const lines = printFixture.lines();
            expect(
                lines.some((l) =>
                    l.includes(
                        "ERROR: received unknown message type: 'noSuchType'",
                    ),
                ),
            ).toBeTruthy();
        });

        test('unexpected envelope logs warning and is dropped', async () => {
            const ns = { ...atExitFixture.ns, ...printFixture.ns } as ServerNS;
            const server = new TestServer(ns);

            const reqPort = getPortHandle(1);

            // Send something that is NOT a request envelope at all
            reqPort.write({ totally: 'not-a-request' });

            await server.readFn();

            const lines = printFixture.lines();
            expect(
                lines.some((l) =>
                    l.includes('WARN: received unexpected request envelope'),
                ),
            ).toBe(true);

            // No handler should be invoked
            expect(mockWithNoResponse).not.toHaveBeenCalled();
            expect(mockWithResponse).not.toHaveBeenCalled();
        });

        test('missing handler throws (server definition error)', async () => {
            const ns = { ...atExitFixture.ns, ...printFixture.ns } as ServerNS;

            // Build a server with a missing handler
            class BrokenServer extends BaseServer<TestProtocolDef> {
                constructor() {
                    const req = getPortHandle(1);
                    const res = getPortHandle(2);
                    const handlers: Handlers<TestProtocolDef> = {
                        // withNoResponse missing entirely
                        withResponse: async (payload) =>
                            mockWithResponse(payload as string),
                    } as unknown as Handlers<TestProtocolDef>;
                    super(ns, TestProtocol, req, res, handlers);
                }
            }

            const server = new BrokenServer();

            // Craft a valid protocol request for the missing handler
            const reqPort = getPortHandle(1);
            const validRequestForMissing = {
                type: 'withNoResponse',
                id: null,
                payload: 'ping',
            } satisfies RequestUnknown;
            reqPort.write(validRequestForMissing);

            // No response should be written for server definition error
            const resPort = getPortHandle(2);
            expect(resPort.peek()).toBe('NULL PORT DATA');

            await expect(server.readFn()).rejects.toThrow(
                /missing handler for message type withNoResponse/,
            );
        });
    });

    describe('integration tests', () => {
        test('sendAndReceive round-trips a message via readLoop', async () => {
            // Use real timers for this integration path
            jest.useRealTimers();

            const ns = { ...atExitFixture.ns, ...printFixture.ns } as ServerNS;
            const server = new TestServer(ns);
            const client = new TestClient();

            // Start read loop (don’t await it)
            const loopPromise = server.readLoop();

            // Fire a request and await response
            const responsePromise = client.sendAndReceive('hello');

            await expect(responsePromise).resolves.toBe(5n);
            expect(mockWithResponse).toHaveBeenCalledTimes(1);
            expect(mockWithResponse).toHaveBeenCalledWith('hello');

            // Stop the read loop
            atExitFixture.runAll();

            // Give the loop a moment to observe running=false and return
            await microtaskPump(4);
            await expect(loopPromise).resolves.toBeUndefined();
        });

        test('fire-and-forget request hits the right handler via readLoop', async () => {
            jest.useRealTimers();

            const ns = { ...atExitFixture.ns, ...printFixture.ns } as ServerNS;
            const server = new TestServer(ns);
            const client = new TestClient();

            const loopPromise = server.readLoop();

            // Fire a best-effort send; it should enqueue and be consumed
            const ok = client.attempt('hi');
            expect(ok).toBe(true);

            // Allow the loop to drain the request queue
            await microtaskPump(4);

            expect(mockWithNoResponse).toHaveBeenCalledTimes(1);
            expect(mockWithNoResponse).toHaveBeenCalledWith('hi');

            atExitFixture.runAll();
            await loopPromise;
        });

        test('server backpressure loop waits until response port has space', async () => {
            // This exercises the `while (!responsePort.tryWrite(response)) { await sleep(20); }` path
            // by filling the response port to capacity, sending a request, then freeing space.
            jest.useRealTimers();

            const ns = { ...atExitFixture.ns, ...printFixture.ns } as ServerNS;
            const server = new TestServer(ns);
            const client = new TestClient();

            const resPort = getPortHandle(2);

            // Fill the response port to capacity so server cannot write immediately.
            // The ports fixture should default to capacity=100 (or whatever your default is).
            // We only need to fill until tryWrite() returns false at least once.
            let wrote = true;
            const blocker = { sentinel: true };
            while (wrote) {
                wrote = resPort.tryWrite(blocker);
            }

            const loopPromise = server.readLoop();

            // Now send a request that expects a response
            const responsePromise = client.sendAndReceive('blockme');

            // Give the server time to read & attempt (and block on) writing the response
            await microtaskPump(6);

            // The promise should still be pending because the server can’t write yet.
            // Free one slot in the response port to unblock the server
            resPort.read(); // consume one blocker
            // Clean up: drain remaining blockers so loop can continue cleanly
            while (resPort.peek()?.sentinel) resPort.read();

            // Allow event loop to continue; server should complete tryWrite and client resolves
            const result = await responsePromise;
            expect(result).toBe(7n);

            atExitFixture.runAll();
            await loopPromise;
        });

        test('readLoop idles until a write occurs (nextWrite wakeup)', async () => {
            jest.useRealTimers();

            const ns = { ...atExitFixture.ns, ...printFixture.ns } as ServerNS;
            const server = new TestServer(ns);
            const client = new TestClient();

            const loopPromise = server.readLoop();

            // No writes yet—server should be idling on nextWrite(). Now write.
            const p = client.definitelySend('tick');

            // Allow processing
            await p;

            expect(mockWithNoResponse).toHaveBeenCalledWith('tick');

            atExitFixture.runAll();
            await loopPromise;
        });
    });
});
