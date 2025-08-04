import { describe, expect, test } from '@jest/globals';

import { MemoryAllocator, Worker } from 'services/new_allocator';

describe('can create an allocator', () => {
    test('can register workers', () => {
        const alloc = new MemoryAllocator();

        const worker1 = new Worker(8);
        alloc.pushWorker(worker1);
        expect(alloc.getFreeRamTotal()).toEqual(8);

        const worker2 = new Worker(4);
        alloc.pushWorker(worker2);
        expect(alloc.getFreeRamTotal()).toEqual(12);
    });
});
