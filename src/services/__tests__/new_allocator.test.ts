import { describe, expect, test } from '@jest/globals';

import { MemoryAllocator, Worker } from 'services/new_allocator';

describe('can create an allocator', () => {
    test('can register workers', () => {
        const alloc = new MemoryAllocator();

        const worker1 = new Worker('a', 8);
        alloc.pushWorker(worker1);
        expect(alloc.getFreeRamTotal()).toEqual(8);

        const worker2 = new Worker('b', 4);
        alloc.pushWorker(worker2);
        expect(alloc.getFreeRamTotal()).toEqual(12);

        expect(alloc.getFreeChunks()).toEqual([
            { hostname: 'a', freeRam: 8 },
            { hostname: 'b', freeRam: 4 },
        ]);
    });

    test('can update worker used RAM', () => {
        const alloc = new MemoryAllocator();

        const worker1 = new Worker('a', 16);
        alloc.pushWorker(worker1);
        expect(alloc.getFreeRamTotal()).toEqual(16);

        worker1.updateSetAsideRam(2);
        expect(alloc.getFreeRamTotal()).toEqual(14);

        const worker2 = new Worker('b', 8, 7.99);
        alloc.pushWorker(worker2);

        worker1.updateSetAsideRam(1.01);
        expect(alloc.getFreeRamTotal()).toBeCloseTo(15);
    });
});

describe('basic Worker CRUD', () => {
    test('create workers', () => {
        const w1 = new Worker('home', 8, 2);
        expect(w1.hostname).toBe('home');
        expect(w1.freeRam).toBe(6);

        const w2 = new Worker('n00dles', 4);
        expect(w2.hostname).toBe('n00dles');
        expect(w2.freeRam).toBe(4);

        w2.updateSetAsideRam(0.05);
        expect(w2.freeRam).toBeCloseTo(3.95);
    });

    test('workers can update total RAM', () => {
        const w1 = new Worker('pserv-1', 16);
        expect(w1.freeRam).toBe(16);

        w1.updateTotalRam(32);
        expect(w1.freeRam).toBe(32);

        const w2 = new Worker('pserv-2', 8, 0.03);
        expect(w2.freeRam).toBeCloseTo(7.97);

        w2.updateTotalRam(16);
        expect(w2.freeRam).toBeCloseTo(15.97);
    });

    test('workers track RAM allocations', () => {
        const w1 = new Worker('a', 8);
        expect(w1.usedRam).toBe(0);

        expect(w1.allocate(2, 1)).toEqual({
            hostname: 'a',
            chunkSize: 2,
            numChunks: 1,
        });
        expect(w1.usedRam).toBe(2);
        expect(w1.freeRam).toBe(6);

        w1.free(2, 1);
        expect(w1.usedRam).toBe(0);
        expect(w1.freeRam).toBe(8);
    });

    describe('worker cannot allocate more than total RAM', () => {
        test('in one shot', () => {
            const w1 = new Worker('a', 4);
            expect(w1.usedRam).toBe(0);
            expect(w1.freeRam).toBe(4);

            expect(w1.allocate(5, 1)).toBeNull();
            expect(w1.usedRam).toBe(0);
            expect(w1.freeRam).toBe(4);

            expect(w1.allocate(2, 3)).toBeNull();
            expect(w1.usedRam).toBe(0);
            expect(w1.freeRam).toBe(4);
        });

        test('across multiple allocations', () => {
            const w1 = new Worker('a', 8);
            expect(w1.usedRam).toBe(0);
            expect(w1.freeRam).toBe(8);

            expect(w1.allocate(2, 3)).toEqual({
                hostname: 'a',
                chunkSize: 2,
                numChunks: 3,
            });
            expect(w1.usedRam).toBe(6);
            expect(w1.freeRam).toBe(2);

            expect(w1.allocate(2, 3)).toBeNull();
        });

        test('including set aside RAM', () => {
            const w1 = new Worker('a', 4, 2);
            expect(w1.usedRam).toBe(0);
            expect(w1.freeRam).toBe(2);

            expect(w1.allocate(2, 2)).toBeNull();
        });

        test('not even by a tiny bit', () => {
            const w1 = new Worker('a', 4);
            expect(w1.usedRam).toBe(0);
            expect(w1.freeRam).toBe(4);

            expect(w1.allocate(4.01, 1)).toBeNull();

            w1.updateSetAsideRam(2);
            expect(w1.allocate(2.01, 1)).toBeNull();

            expect(w1.allocate(1, 1)).not.toBeNull();
            expect(w1.allocate(1.01, 1)).toBeNull();
        });
    });

    describe('worker throws when trying to free more memory than has been allocated', () => {
        const w1 = new Worker('a', 4);
        expect(w1.usedRam).toBe(0);
        expect(w1.freeRam).toBe(4);

        expect(w1.allocate(1, 4)).not.toBeNull();
        expect(w1.usedRam).toBe(4);
        expect(w1.freeRam).toBe(0);

        expect(() => w1.free(6, 1)).toThrow(
            'attempted to free 1x6GiB, only 4GiB allocated',
        );
    });
});
