import { Channel, getChannel } from '../channel';

describe('unit', () => {
    describe('constructor', () => {
        test('throws for non-positive capacity', () => {
            expect(() => new Channel(0)).toThrow('Invalid capacity');
            expect(() => new Channel(Infinity)).toThrow('Invalid capacity');
        });

        test('initializes with provided capacity', () => {
            const chan = new Channel<number>(5);
            expect(chan.capacity).toBe(5);
            expect(chan.size()).toBe(0);
            expect(chan.closed).toBe(false);
        });
    });

    describe('size', () => {
        test('reflects number of buffered items', async () => {
            const chan = new Channel<number>(2);
            await chan.write(1);
            expect(chan.size()).toBe(1);
            await chan.write(2);
            expect(chan.size()).toBe(2);
            await chan.read();
            expect(chan.size()).toBe(1);
        });
    });

    describe('empty', () => {
        test('indicates when buffer has no items', async () => {
            const chan = new Channel<number>();
            expect(chan.empty()).toBe(true);
            await chan.write(1);
            expect(chan.empty()).toBe(false);
            await chan.read();
            expect(chan.empty()).toBe(true);
        });
    });

    describe('full', () => {
        test('indicates when buffer is at capacity', async () => {
            const chan = new Channel<number>(1);
            expect(chan.full()).toBe(false);
            await chan.write(1);
            expect(chan.full()).toBe(true);
            await chan.read();
            expect(chan.full()).toBe(false);
        });
    });

    describe('clear', () => {
        test('empties buffer without disturbing pending writers', async () => {
            const chan = new Channel<number>(1);
            await chan.write(1);
            const pendingWrite = chan.write(2);
            chan.clear();
            expect(chan.size()).toBe(0);
            const read = chan.read();
            await expect(pendingWrite).resolves.toBeUndefined();
            await expect(read).resolves.toBe(2);
        });
    });

    describe('close', () => {
        test('rejects pending reads', async () => {
            const chan = new Channel<number>(1);
            const pending = chan.read();
            chan.close();
            await expect(pending).rejects.toThrow('Channel closed');
        });

        test('rejects pending writes', async () => {
            const chan = new Channel<number>(1);
            await chan.write(1);
            const pending = chan.write(2);
            chan.close();
            await expect(pending).rejects.toThrow('Channel closed');
        });
    });

    describe('read', () => {
        afterEach(() => {
            jest.useRealTimers();
        });

        test('returns buffered value in FIFO order', async () => {
            const chan = new Channel<number>(2);
            await chan.write(1);
            await chan.write(2);
            await expect(chan.read()).resolves.toBe(1);
            await expect(chan.read()).resolves.toBe(2);
        });

        test('reads directly from waiting writer', async () => {
            const chan = new Channel<number>();
            const readPromise = chan.read();
            await chan.write(5);
            await expect(readPromise).resolves.toBe(5);
        });

        test('throws when channel closed and empty', async () => {
            const chan = new Channel<number>();
            chan.close();
            await expect(chan.read()).rejects.toThrow('Channel closed');
        });

        test('honors timeout option', async () => {
            jest.useFakeTimers();
            const chan = new Channel<number>();
            const promise = chan.read({ timeoutMs: 5 });
            jest.runAllTimers();
            await expect(promise).rejects.toThrow('Timeout');
        });

        test('honors abort signal', async () => {
            const chan = new Channel<number>();
            const ac = new AbortController();
            const promise = chan.read({ signal: ac.signal });
            ac.abort();
            await expect(promise).rejects.toThrow('Aborted');
        });

        test('honors abort signal even when triggered before read call', async () => {
            const chan = new Channel<number>();
            const ac = new AbortController();
            ac.abort();
            const promise = chan.read({ signal: ac.signal });
            await expect(promise).rejects.toThrow('Aborted');
        });
    });

    describe('write', () => {
        afterEach(() => {
            jest.useRealTimers();
        });

        test('buffers value when space available', async () => {
            const chan = new Channel<number>(2);
            await chan.write(1);
            expect(chan.size()).toBe(1);
        });

        test('hands off to waiting reader', async () => {
            const chan = new Channel<number>();
            const readPromise = chan.read();
            await chan.write(3);
            await expect(readPromise).resolves.toBe(3);
            expect(chan.size()).toBe(0);
        });

        test('waits when full until space frees', async () => {
            const chan = new Channel<number>(1);
            await chan.write(1);
            const writePromise = chan.write(2);
            const read = chan.read();
            await expect(writePromise).resolves.toBeUndefined();
            await expect(read).resolves.toBe(1);
            await expect(chan.read()).resolves.toBe(2);
        });

        test('honors timeout option', async () => {
            jest.useFakeTimers();
            const chan = new Channel<number>(1);
            await chan.write(1);
            const promise = chan.write(2, { timeoutMs: 5 });
            jest.runAllTimers();
            await expect(promise).rejects.toThrow('Timeout');
        });

        test('honors abort signal', async () => {
            const chan = new Channel<number>(1);
            await chan.write(1);
            const ac = new AbortController();
            const promise = chan.write(2, { signal: ac.signal });
            ac.abort();
            await expect(promise).rejects.toThrow('Aborted');
        });

        test('honors abort signal even when triggered before write call', async () => {
            const chan = new Channel<number>(1);
            await chan.write(1);
            const ac = new AbortController();
            ac.abort();
            const promise = chan.write(2, { signal: ac.signal });
            await expect(promise).rejects.toThrow('Aborted');
        });
    });

    describe('async iterator', () => {
        test('yields values as they are written', async () => {
            const chan = new Channel<number>();
            const received: number[] = [];
            const reader = (async () => {
                for await (const v of chan) {
                    received.push(v);
                    if (received.length === 2) break;
                }
            })();
            await chan.write(1);
            await chan.write(2);
            await reader;
            expect(received).toEqual([1, 2]);
        });

        test('exits when channel is closed', async () => {
            const chan = new Channel<number>();
            const received: number[] = [];
            const reader = (async () => {
                for await (const v of chan) {
                    received.push(v);
                }
            })();
            await chan.write(1);
            chan.close();
            await expect(reader).resolves.toBeUndefined();
            expect(received).toEqual([1]);
        });
    });
});

describe('getChannel', () => {
    test('returns a Channel instance', () => {
        const chan = getChannel(10);
        expect(chan).toBeInstanceOf(Channel);
    });

    test('returns same instance for same index', () => {
        const a = getChannel(1);
        const b = getChannel(1);
        const c = getChannel(2);
        expect(a).toBe(b);
        expect(a).not.toBe(c);
    });

    test('throws when given a negative index', () => {
        expect(() => getChannel(-1)).toThrow(RangeError);
    });

    test.each([1.5, Infinity, -Infinity, NaN])(
        'throws when given a non-integer index: %s',
        (i) => {
            expect(() => getChannel(i)).toThrow(RangeError);
        },
    );
});

describe('integration', () => {
    test('multiple pending readers receive values in order', async () => {
        const chan = new Channel<number>();
        const p1 = chan.read();
        const p2 = chan.read();
        await chan.write(1);
        await chan.write(2);
        await expect(p1).resolves.toBe(1);
        await expect(p2).resolves.toBe(2);
    });

    test('reads that timeout are cleaned up properly', async () => {
        jest.useFakeTimers();

        const chan = new Channel<number>();

        const pendingRead = chan.read({ timeoutMs: 10 });
        jest.runAllTimers();
        await expect(pendingRead).rejects.toThrow('Timeout');

        const p1 = chan.read();
        const p2 = chan.read();
        await chan.write(1);
        await chan.write(2);
        await expect(p1).resolves.toBe(1);
        await expect(p2).resolves.toBe(2);
    });
});
