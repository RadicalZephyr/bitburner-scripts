import { describe, expect, jest, test } from '@jest/globals';

import { createAtExitFixture } from '../nsAtExitFixture';

describe('createAtExitFixture', () => {
    test('exposes an ns stub with atExit()', () => {
        const fx = createAtExitFixture();
        expect(typeof fx.ns.atExit).toBe('function');
    });

    describe('registration & introspection', () => {
        test('registers a default id when none provided', () => {
            const fx = createAtExitFixture();
            const ran: string[] = [];
            fx.ns.atExit(() => ran.push('default'));

            expect(fx.getIds()).toEqual(['default']);
            expect(fx.size()).toBe(1);
        });

        test('registers under a custom id', () => {
            const fx = createAtExitFixture();
            fx.ns.atExit(() => null, 'alpha');
            fx.ns.atExit(() => null, 'beta');

            expect(fx.getIds()).toEqual(['alpha', 'beta']);
            expect(fx.size()).toBe(2);
        });

        test('last write wins for the same id, preserving overall insertion order', () => {
            const fx = createAtExitFixture();
            const calls: string[] = [];

            // First alpha, then beta, then overwrite alpha.
            fx.ns.atExit(() => calls.push('alpha/first'), 'alpha');
            fx.ns.atExit(() => calls.push('beta'), 'beta');
            fx.ns.atExit(() => calls.push('alpha/second'), 'alpha'); // overwrite

            // After overwrite, the final order should be: beta (first inserted), alpha (re-inserted).
            expect(fx.getIds()).toEqual(['beta', 'alpha']);

            fx.runAll();
            expect(calls).toEqual(['beta', 'alpha/second']);
            expect(fx.size()).toBe(0);
        });
    });

    describe('execution: run() vs runAll()', () => {
        test('run() executes only the default id and leaves others', () => {
            const fx = createAtExitFixture();
            const calls: string[] = [];

            fx.ns.atExit(() => calls.push('default')); // default
            fx.ns.atExit(() => calls.push('alpha'), 'alpha');
            fx.ns.atExit(() => calls.push('beta'), 'beta');

            fx.run(); // runs only "default"
            expect(calls).toEqual(['default']);
            expect(fx.getIds()).toEqual(['alpha', 'beta']);
            expect(fx.size()).toBe(2);

            // Now run all remaining
            fx.runAll();
            expect(calls).toEqual(['default', 'alpha', 'beta']);
            expect(fx.size()).toBe(0);
        });

        test('run(id) executes only that id', () => {
            const fx = createAtExitFixture();
            const calls: string[] = [];

            fx.ns.atExit(() => calls.push('alpha'), 'alpha');
            fx.ns.atExit(() => calls.push('beta'), 'beta');

            fx.run('beta');
            expect(calls).toEqual(['beta']);
            expect(fx.getIds()).toEqual(['alpha']);
            expect(fx.size()).toBe(1);
        });

        test('runAll() executes in insertion order across ids', () => {
            const fx = createAtExitFixture();
            const calls: string[] = [];

            fx.ns.atExit(() => calls.push('first'), 'a');
            fx.ns.atExit(() => calls.push('second'), 'b');
            fx.ns.atExit(() => calls.push('third'), 'c');

            fx.runAll();
            expect(calls).toEqual(['first', 'second', 'third']);
            expect(fx.size()).toBe(0);
        });

        test('runAll() is idempotent (second call does nothing)', () => {
            const fx = createAtExitFixture();
            const calls: string[] = [];
            fx.ns.atExit(() => calls.push('once'), 'x');

            fx.runAll();
            fx.runAll();
            expect(calls).toEqual(['once']);
            expect(fx.size()).toBe(0);
        });

        test('run() is safe when nothing is registered', () => {
            const fx = createAtExitFixture();
            expect(() => fx.run()).not.toThrow();
            expect(fx.size()).toBe(0);
        });

        test('runAll() is safe when nothing is registered', () => {
            const fx = createAtExitFixture();
            expect(() => fx.runAll()).not.toThrow();
            expect(fx.size()).toBe(0);
        });
    });

    describe('reset()', () => {
        test('clears all registrations without running them', () => {
            const fx = createAtExitFixture();
            const calls: string[] = [];

            fx.ns.atExit(() => calls.push('default'));
            fx.ns.atExit(() => calls.push('alpha'), 'alpha');

            fx.reset();
            expect(fx.size()).toBe(0);
            fx.runAll();
            expect(calls).toEqual([]); // nothing ran
        });
    });

    describe('error propagation', () => {
        test('throws when a handler throws (runAll)', () => {
            const fx = createAtExitFixture();
            fx.ns.atExit(() => {
                throw new Error('boom');
            }, 'x');

            expect(() => fx.runAll()).toThrow('boom');
            // After exception, fixture clears and marks done; size should be 0
            expect(fx.size()).toBe(0);
        });

        test('throws when a handler throws (run single)', () => {
            const fx = createAtExitFixture();
            fx.ns.atExit(() => {
                throw new Error('single-boom');
            }, 'x');

            expect(() => fx.run('x')).toThrow('single-boom');
            // Only that handler was removed
            expect(fx.size()).toBe(0);
        });
    });

    describe('shutdown-time registrations are ignored', () => {
        test('handlers registered during runAll() are ignored', () => {
            const fx = createAtExitFixture();
            const calls: string[] = [];

            fx.ns.atExit(() => {
                calls.push('first');
                // Attempt to register during shutdown
                fx.ns.atExit(() => calls.push('late'), 'late');
            }, 'first');

            fx.runAll();
            expect(calls).toEqual(['first']);
            // The "late" registration should not exist
            expect(fx.getIds()).toEqual([]);
            expect(fx.size()).toBe(0);
        });

        test('handlers registered during run(id) are ignored', () => {
            const fx = createAtExitFixture();
            const calls: string[] = [];

            fx.ns.atExit(() => {
                calls.push('alpha');
                fx.ns.atExit(() => calls.push('late'), 'late');
            }, 'alpha');

            fx.run('alpha'); // run only 'alpha'
            expect(calls).toEqual(['alpha']);
            expect(fx.getIds()).toEqual([]); // 'late' ignored
        });
    });

    describe('hookJest(afterEachLike)', () => {
        test('wires an afterEach-like hook to auto runAll() and reset()', () => {
            const fx = createAtExitFixture();
            const calls: string[] = [];
            const afterEachMock = jest.fn<(fn: () => void) => void>();

            // Capture the callback we pass to afterEach and call it manually to simulate Jest.
            let registeredAfterEach: (() => void) | undefined;
            afterEachMock.mockImplementation((fn) => {
                registeredAfterEach = fn;
            });

            fx.hookJest(afterEachMock);
            expect(afterEachMock).toHaveBeenCalledTimes(1);
            expect(typeof registeredAfterEach).toBe('function');

            // Register some handlers
            fx.ns.atExit(() => calls.push('default')); // default
            fx.ns.atExit(() => calls.push('alpha'), 'alpha');

            // Simulate end-of-test
            registeredAfterEach!();

            // Should have run everything and reset
            expect(calls).toEqual(['default', 'alpha']);
            expect(fx.size()).toBe(0);

            // Running the captured afterEach again should be a no-op
            registeredAfterEach!();
            expect(calls).toEqual(['default', 'alpha']);
            expect(fx.size()).toBe(0);
        });

        test('works with multiple fixtures independently', () => {
            const fx1 = createAtExitFixture();
            const fx2 = createAtExitFixture();
            const calls1: string[] = [];
            const calls2: string[] = [];

            // One shared mock "afterEach" that both fixtures register against
            const afterEachMock = jest.fn<(fn: () => void) => void>();
            const callbacks: Array<() => void> = [];
            afterEachMock.mockImplementation((fn) => callbacks.push(fn));

            fx1.hookJest(afterEachMock);
            fx2.hookJest(afterEachMock);
            expect(callbacks.length).toBe(2);

            fx1.ns.atExit(() => calls1.push('a1'), 'a1');
            fx2.ns.atExit(() => calls2.push('b1'), 'b1');

            // Simulate Jest calling afterEach for the test: it would call both hooks
            callbacks.forEach((cb) => cb());

            expect(calls1).toEqual(['a1']);
            expect(calls2).toEqual(['b1']);
            expect(fx1.size()).toBe(0);
            expect(fx2.size()).toBe(0);
        });
    });

    describe('determinism & state transitions', () => {
        test('calling run() twice only executes once for the chosen id', () => {
            const fx = createAtExitFixture();
            const calls: string[] = [];
            fx.ns.atExit(() => calls.push('alpha'), 'alpha');

            fx.run('alpha');
            fx.run('alpha');
            expect(calls).toEqual(['alpha']);
            expect(fx.size()).toBe(0);
        });

        test('runAll() after a run(id) executes remaining handlers only', () => {
            const fx = createAtExitFixture();
            const calls: string[] = [];
            fx.ns.atExit(() => calls.push('alpha'), 'alpha');
            fx.ns.atExit(() => calls.push('beta'), 'beta');

            fx.run('alpha');
            expect(calls).toEqual(['alpha']);
            expect(fx.getIds()).toEqual(['beta']);

            fx.runAll();
            expect(calls).toEqual(['alpha', 'beta']);
            expect(fx.size()).toBe(0);
        });
    });
});
