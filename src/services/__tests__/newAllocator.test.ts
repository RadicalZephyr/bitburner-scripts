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

        worker1.setAsideRam(2);
        expect(alloc.getFreeRamTotal()).toEqual(14);

        const worker2 = new Worker('b', 8);
        alloc.pushWorker(worker2);

        worker2.setAsideRam(7.99);
        worker1.setAsideRam(1.01);
        expect(alloc.getFreeRamTotal()).toBeCloseTo(15);
    });
});
