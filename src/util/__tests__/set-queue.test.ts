import { SetQueue } from '../set-queue';

describe('SetQueue', () => {
    describe('constructor', () => {
        test('new list is empty with size 0', () => {
            const q = new SetQueue<object>();
            expect(q.isEmpty()).toBe(true);
            expect(q.size).toBe(0);
        });
    });

    describe('push', () => {
        test('increases size and makes list non-empty', () => {
            const q = new SetQueue<object>();
            const a = {};
            q.push(a);
            expect(q.isEmpty()).toBe(false);
            expect(q.size).toBe(1);
        });

        test('ignores duplicate pushes of same element', () => {
            const q = new SetQueue<number>();
            q.push(1);
            q.push(1);
            q.push(1);
            expect(q.size).toBe(1);
            expect(Array.from(q.values())).toEqual([1]);
        });

        test('allows re-adding element after removal', () => {
            const q = new SetQueue<number>();
            q.push(1);
            expect(q.shift()).toBe(1);
            q.push(1);
            expect(q.size).toBe(1);
            expect(Array.from(q.values())).toEqual([1]);
        });
    });

    describe('shift', () => {
        test('shift removes and returns the oldest element (FIFO)', () => {
            const q = new SetQueue<number>();
            q.push(1);
            q.push(2);
            q.push(3);
            expect(q.shift()).toBe(1);
            expect(q.shift()).toBe(2);
            expect(q.shift()).toBe(3);
        });

        test('shift on empty returns undefined and does not change size', () => {
            const q = new SetQueue<number>();
            expect(q.shift()).toBeUndefined();
            expect(q.size).toBe(0);
        });

        test('shift after deleting head returns the new head', () => {
            const q = new SetQueue<number>();
            const a = 1,
                b = 2,
                c = 3;
            q.push(a);
            q.push(b);
            q.push(c);
            // delete current head (a)
            expect(q.delete(a)).toBe(true);
            expect(q.shift()).toBe(b);
            expect(q.shift()).toBe(c);
            expect(q.shift()).toBeUndefined();
        });

        test('shift after delete middle element maintains FIFO for remaining', () => {
            const q = new SetQueue<number>();
            const a = 1,
                b = 2,
                c = 3,
                d = 4;
            q.push(a);
            q.push(b);
            q.push(c);
            q.push(d);
            // remove middle (b)
            expect(q.delete(b)).toBe(true);
            expect(q.shift()).toBe(a);
            expect(q.shift()).toBe(c);
            expect(q.shift()).toBe(d);
            expect(q.shift()).toBeUndefined();
        });

        test('shift after deleting tail element returns all earlier elements', () => {
            const q = new SetQueue<number>();
            const a = 1,
                b = 2,
                c = 3;
            q.push(a);
            q.push(b);
            q.push(c);
            expect(q.delete(c)).toBe(true); // removed tail
            expect(q.shift()).toBe(a);
            expect(q.shift()).toBe(b);
            expect(q.shift()).toBeUndefined();
        });

        test('multiple consecutive shifts behave correctly across empty boundary', () => {
            const q = new SetQueue<number>();
            q.push(1);
            expect(q.shift()).toBe(1);
            expect(q.shift()).toBeUndefined(); // already empty
            q.push(2);
            expect(q.shift()).toBe(2);
            expect(q.shift()).toBeUndefined();
        });

        test('shift after deleting all elements returns undefined and leaves size 0', () => {
            const q = new SetQueue<number>();
            q.push(1);
            q.push(2);
            q.delete(1);
            q.delete(2);
            expect(q.shift()).toBeUndefined();
            expect(q.size).toBe(0);
            expect(q.isEmpty()).toBe(true);
        });
    });

    describe('delete', () => {
        test('returns false for an element that was never pushed', () => {
            const q = new SetQueue<object>();
            const a = {};
            const b = {};
            q.push(a);
            expect(q.delete(b)).toBe(false);
            expect(q.size).toBe(1);
        });

        test('returns true for an element currently pushed', () => {
            const q = new SetQueue<object>();
            const a = {};
            q.push(a);
            expect(q.delete(a)).toBe(true);
            expect(q.size).toBe(0);
            expect(q.isEmpty()).toBe(true);
        });

        test('same element twice returns false the second time', () => {
            const q = new SetQueue<object>();
            const a = {};
            q.push(a);
            expect(q.delete(a)).toBe(true);
            expect(q.delete(a)).toBe(false);
        });

        test('on empty list is safe and returns false', () => {
            const q = new SetQueue<number>();
            expect(q.delete(123)).toBe(false);
            expect(q.size).toBe(0);
            expect(q.isEmpty()).toBe(true);
        });

        test('deleting an element already shifted out returns false', () => {
            const q = new SetQueue<number>();
            q.push(1);
            const first = q.shift();
            expect(first).toBe(1);
            // first is a primitive; deleting by value is how WaitList works for primitives
            expect(q.delete(1)).toBe(false);
            expect(q.size).toBe(0);
        });
    });

    describe('values', () => {
        test('values() yields elements in FIFO order (snapshot semantics)', () => {
            const q = new SetQueue<number>();
            q.push(10);
            q.push(20);
            q.push(30);

            const snapshot = Array.from(q.values());
            expect(snapshot).toEqual([10, 20, 30]);

            // Ensure iteration did not mutate
            expect(q.shift()).toBe(10);
            expect(q.shift()).toBe(20);
            expect(q.shift()).toBe(30);
        });

        test('values() reflects insertion order after removals of arbitrary items', () => {
            const q = new SetQueue<number>();
            q.push(1);
            q.push(2);
            q.push(3);
            q.push(4);

            // remove 2 and 4
            expect(q.delete(2)).toBe(true);
            expect(q.delete(4)).toBe(true);

            expect(Array.from(q.values())).toEqual([1, 3]);
        });
    });

    describe('clear', () => {
        test('clear empties the list and resets size', () => {
            const q = new SetQueue<number>();
            q.push(1);
            q.push(2);
            q.push(3);
            expect(q.size).toBe(3);

            q.clear();
            expect(q.isEmpty()).toBe(true);
            expect(q.size).toBe(0);
            expect(q.shift()).toBeUndefined();
            expect(Array.from(q.values())).toEqual([]);
        });

        test('after clear, push/shift works from clean state', () => {
            const q = new SetQueue<string>();
            q.push('a');
            q.push('b');
            q.clear();

            q.push('x');
            q.push('y');
            expect(q.shift()).toBe('x');
            expect(q.shift()).toBe('y');
            expect(q.shift()).toBeUndefined();
        });
    });

    describe('size', () => {
        test('size tracks push, remove, and shift precisely', () => {
            const q = new SetQueue<number>();
            const a = 1,
                b = 2,
                c = 3;
            expect(q.size).toBe(0);
            q.push(a);
            expect(q.size).toBe(1);
            q.push(b);
            q.push(c);
            expect(q.size).toBe(3);
            expect(q.delete(b)).toBe(true);
            expect(q.size).toBe(2);
            expect(q.shift()).toBe(a);
            expect(q.size).toBe(1);
            expect(q.shift()).toBe(c);
            expect(q.size).toBe(0);
        });
    });

    describe('SetQueue.drain()', () => {
        test('drain on empty returns 0 and leaves list empty', () => {
            const q = new SetQueue<number>();

            expect(q.drain()).toEqual([]);
            expect(q.size).toBe(0);
            expect(q.isEmpty()).toBe(true);
        });

        test('drain clears all by default', () => {
            const q = new SetQueue<number>();
            [1, 2, 3].forEach((x) => q.push(x));

            const drained = q.drain(); // no limit → drain all
            expect(drained.length).toBe(3);
            expect(q.size).toBe(0);
            expect(q.isEmpty()).toBe(true);
        });

        test('drain collects items in FIFO order into provided array', () => {
            const q = new SetQueue<string>();
            ['a', 'b', 'c'].forEach((x) => q.push(x));

            expect(q.drain()).toEqual(['a', 'b', 'c']);
            expect(q.size).toBe(0);
        });

        test('drain with limit < size drains only that many and leaves the rest', () => {
            const q = new SetQueue<number>();
            [10, 20, 30, 40].forEach((x) => q.push(x));

            expect(q.drain(2)).toEqual([10, 20]);
            // Remaining should be [30, 40] in FIFO order
            expect(Array.from(q.values())).toEqual([30, 40]);
            expect(q.size).toBe(2);
        });

        test('drain with limit 0 drains nothing', () => {
            const q = new SetQueue<number>();
            [1, 2, 3].forEach((x) => q.push(x));

            expect(q.drain(0)).toEqual([]);
            expect(Array.from(q.values())).toEqual([1, 2, 3]);
            expect(q.size).toBe(3);
        });

        test('drain with limit greater than size drains all remaining', () => {
            const q = new SetQueue<number>();
            [5, 6].forEach((x) => q.push(x));

            expect(q.drain(10)).toEqual([5, 6]);
            expect(q.size).toBe(0);
        });

        test('drain after partial removals maintains FIFO of the remaining', () => {
            const q = new SetQueue<number>();
            [1, 2, 3, 4, 5].forEach((x) => q.push(x));
            // Delete a couple of arbitrary elements (simulate aborts/timeouts)
            expect(q.delete(2)).toBe(true);
            expect(q.delete(4)).toBe(true);

            expect(q.drain()).toEqual([1, 3, 5]);
            expect(q.size).toBe(0);
        });

        test('subsequent push/shift works after full drain', () => {
            const q = new SetQueue<string>();
            ['x', 'y'].forEach((x) => q.push(x));

            expect(q.drain()).toStrictEqual(['x', 'y']);
            q.push('z');
            expect(q.shift()).toBe('z');
            expect(q.shift()).toBeUndefined();
        });
    });

    describe('complex', () => {
        test('interleaved push/shift preserves FIFO of live elements', () => {
            const q = new SetQueue<number>();
            q.push(1);
            q.push(2);
            expect(q.shift()).toBe(1);
            q.push(3);
            q.push(4);
            expect(q.shift()).toBe(2);
            q.push(5);
            expect(q.shift()).toBe(3);
            expect(q.shift()).toBe(4);
            expect(q.shift()).toBe(5);
            expect(q.shift()).toBeUndefined();
        });

        test('works with reference types and identity semantics (objects)', () => {
            const q = new SetQueue<object>();
            const a = { id: 'a' };
            const b = { id: 'b' };
            const aClone = { id: 'a' };

            q.push(a);
            q.push(b);
            // Deleting aClone (same shape, different identity) should fail
            expect(q.delete(aClone)).toBe(false);
            // Deleting original 'a' succeeds
            expect(q.delete(a)).toBe(true);
            expect(Array.from(q.values())).toEqual([b]);
        });
    });
});
