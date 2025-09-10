import { RingBuffer } from '../ring-buffer';

describe('RingBuffer', () => {
    describe('constructor & capacity rounding', () => {
        test('throws on invalid capacities', () => {
            expect(() => new RingBuffer(0)).toThrow(/Invalid capacity/);
            expect(() => new RingBuffer(-1)).toThrow(/Invalid capacity/);
            expect(() => new RingBuffer(Number.POSITIVE_INFINITY)).toThrow(
                /Invalid capacity/,
            );
            // NaN is not > 0 or finite
            expect(() => new RingBuffer(NaN)).toThrow(/Invalid capacity/);
        });

        test('rounds capacity up to next power of two by default', () => {
            expect(new RingBuffer(1).capacity).toBe(1);
            expect(new RingBuffer(2).capacity).toBe(2);
            expect(new RingBuffer(3).capacity).toBe(4);
            expect(new RingBuffer(4).capacity).toBe(4);
            expect(new RingBuffer(5).capacity).toBe(8);
            expect(new RingBuffer(8).capacity).toBe(8);
            // non-integer gets ceiled before rounding
            // 2.2 -> ceil 3 -> pow2 4
            expect(new RingBuffer(2.2).capacity).toBe(4);
        });

        test('can disable rounding and keep exact (ceiled) capacity', () => {
            // 5 -> ceil 5; no pow2
            expect(
                new RingBuffer(5, { roundCapacityToPow2: false }).capacity,
            ).toBe(5);
            // 3.2 -> ceil 4; no pow2 step
            expect(
                new RingBuffer(3.2, { roundCapacityToPow2: false }).capacity,
            ).toBe(4);
        });
    });

    describe('basic operations', () => {
        test('push/shift round-trip and FIFO order', () => {
            const rb = new RingBuffer<number>(4);
            expect(rb.size).toBe(0);
            expect(rb.isEmpty()).toBe(true);
            expect(rb.isFull()).toBe(false);

            expect(rb.push(1)).toBe(true);
            expect(rb.push(2)).toBe(true);
            expect(rb.push(3)).toBe(true);
            expect(rb.size).toBe(3);
            expect(rb.isEmpty()).toBe(false);
            expect(rb.isFull()).toBe(false);

            expect(rb.shift()).toBe(1);
            expect(rb.shift()).toBe(2);
            expect(rb.size).toBe(1);
            expect(rb.isFull()).toBe(false);

            expect(rb.push(4)).toBe(true);
            expect(rb.push(5)).toBe(true);
            expect(rb.push(6)).toBe(true); // now full (capacity 4; currently had 1 + 3 pushes -> 4)
            expect(rb.isFull()).toBe(true);
            expect(rb.push(7)).toBe(false); // cannot push when full

            expect(rb.shift()).toBe(3);
            expect(rb.shift()).toBe(4);
            expect(rb.shift()).toBe(5);
            expect(rb.shift()).toBe(6);
            expect(rb.shift()).toBeUndefined(); // empty
            expect(rb.isEmpty()).toBe(true);
            expect(rb.size).toBe(0);
        });

        test('peek returns next item without removing it', () => {
            const rb = new RingBuffer<string>(2);
            expect(rb.peek()).toBeUndefined();

            expect(rb.push('a')).toBe(true);
            expect(rb.peek()).toBe('a');
            expect(rb.size).toBe(1);

            expect(rb.push('b')).toBe(true);
            expect(rb.peek()).toBe('a');
            expect(rb.size).toBe(2);

            expect(rb.shift()).toBe('a');
            expect(rb.peek()).toBe('b');
            expect(rb.shift()).toBe('b');
            expect(rb.peek()).toBeUndefined();
        });

        //  with and without out array, and with limits
        describe('drain', () => {
            test('when empty', () => {
                const rb = new RingBuffer<number>(8);

                // drain when empty
                const out0: number[] = [];
                expect(rb.drain(out0)).toBe(0);
                expect(out0).toEqual([]);
            });

            test('with limit smaller than size', () => {
                const rb = new RingBuffer<number>(8);

                [1, 2, 3, 4, 5].forEach((n) => expect(rb.push(n)).toBe(true));
                expect(rb.size).toBe(5);

                const out1: number[] = [];
                expect(rb.drain(out1, 2)).toBe(2);
                expect(out1).toEqual([1, 2]);
                expect(rb.size).toBe(3);
            });

            test('remaining without limit argument', () => {
                const rb = new RingBuffer<number>(8);

                [3, 4, 5].forEach((n) => expect(rb.push(n)).toBe(true));

                const out2: number[] = [];
                expect(rb.drain(out2)).toBe(3);
                expect(out2).toEqual([3, 4, 5]);
                expect(rb.size).toBe(0);
            });

            test('to no array (just count)', () => {
                const rb = new RingBuffer<number>(8);

                [10, 20, 30].forEach((n) => rb.push(n));
                expect(rb.drain(undefined, 2)).toBe(2);
                expect(rb.size).toBe(1);
                expect(rb.shift()).toBe(30);
                expect(rb.size).toBe(0);
            });
        });

        test("values() iterates current contents in order and doesn't mutate", () => {
            const rb = new RingBuffer<string>(4);
            ['x', 'y', 'z'].forEach((v) => rb.push(v));

            const iterated = Array.from(rb.values());
            expect(iterated).toEqual(['x', 'y', 'z']);
            // buffer remains intact
            expect(rb.size).toBe(3);
            expect(rb.shift()).toBe('x');
            expect(rb.shift()).toBe('y');
            expect(rb.shift()).toBe('z');
            expect(rb.shift()).toBeUndefined();
        });
    });

    describe('wrap-around behavior', () => {
        test('head/tail wrap correctly (no data loss, correct order)', () => {
            const rb = new RingBuffer<number>(4); // capacity is pow2 already

            // Fill to full: [0,1,2,3]
            [0, 1, 2, 3].forEach((n) => expect(rb.push(n)).toBe(true));
            expect(rb.isFull()).toBe(true);

            // Remove two: take 0,1
            expect(rb.shift()).toBe(0);
            expect(rb.shift()).toBe(1);
            expect(rb.size).toBe(2);

            // Push two more to wrap: [2,3,4,5]
            expect(rb.push(4)).toBe(true);
            expect(rb.push(5)).toBe(true);
            expect(rb.isFull()).toBe(true);

            // Ensure order preserved after wrap
            expect(Array.from(rb.values())).toEqual([2, 3, 4, 5]);

            // Drain all and verify
            expect(rb.shift()).toBe(2);
            expect(rb.shift()).toBe(3);
            expect(rb.shift()).toBe(4);
            expect(rb.shift()).toBe(5);
            expect(rb.shift()).toBeUndefined();
            expect(rb.size).toBe(0);
        });

        test('works with non power-of-two capacity when rounding disabled', () => {
            const rb = new RingBuffer<number>(5, {
                roundCapacityToPow2: false,
            });
            expect(rb.capacity).toBe(5);

            [1, 2, 3, 4, 5].forEach((n) => expect(rb.push(n)).toBe(true));
            expect(rb.push(6)).toBe(false); // full

            // pop a couple
            expect(rb.shift()).toBe(1);
            expect(rb.shift()).toBe(2);

            // push and wrap
            expect(rb.push(6)).toBe(true);
            expect(rb.push(7)).toBe(true);
            expect(rb.isFull()).toBe(true);

            // verify content order
            expect(Array.from(rb.values())).toEqual([3, 4, 5, 6, 7]);
        });
    });

    describe('clear()', () => {
        test('clear() with "slot" strategy drops refs for occupied slots and resets indices', () => {
            const rb = new RingBuffer<object>(4, {
                roundCapacityToPow2: true,
                clearStrategy: 'slot',
            });
            const objs = [{ a: 1 }, { b: 2 }, { c: 3 }];
            objs.forEach((o) => rb.push(o));
            expect(rb.size).toBe(3);

            rb.clear();
            expect(rb.size).toBe(0);
            expect(rb.isEmpty()).toBe(true);
            // Can reuse buffer immediately
            expect(rb.push({ d: 4 })).toBe(true);
            expect(rb.shift()).toEqual({ d: 4 });
            expect(rb.shift()).toBeUndefined();
        });

        test('clear() with "buffer" strategy replaces backing store and resets indices', () => {
            const rb = new RingBuffer<number>(8, { clearStrategy: 'buffer' });
            [1, 2, 3, 4, 5].forEach((n) => rb.push(n));
            expect(rb.size).toBe(5);

            rb.clear();
            expect(rb.size).toBe(0);
            expect(rb.isEmpty()).toBe(true);

            // After buffer replacement, it still functions normally
            [10, 11].forEach((n) => rb.push(n));
            expect(Array.from(rb.values())).toEqual([10, 11]);
            expect(rb.shift()).toBe(10);
            expect(rb.shift()).toBe(11);
            expect(rb.shift()).toBeUndefined();
        });
    });

    describe('empty/overflow edge cases', () => {
        test('shift on empty returns undefined; push on full returns false', () => {
            const rb = new RingBuffer<number>(1);
            expect(rb.shift()).toBeUndefined();
            expect(rb.push(42)).toBe(true);
            expect(rb.push(99)).toBe(false);
            expect(rb.shift()).toBe(42);
            expect(rb.shift()).toBeUndefined();
        });

        test('peek on empty returns undefined; after operations remains correct', () => {
            const rb = new RingBuffer<string>(3);
            expect(rb.peek()).toBeUndefined();

            expect(rb.push('A')).toBe(true);
            expect(rb.peek()).toBe('A');
            expect(rb.push('B')).toBe(true);
            expect(rb.peek()).toBe('A');

            expect(rb.shift()).toBe('A');
            expect(rb.peek()).toBe('B');

            expect(rb.shift()).toBe('B');
            expect(rb.peek()).toBeUndefined();
        });
    });
});
