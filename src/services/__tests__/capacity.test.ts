import { maxChunksForSnapshot, MemorySnapshot } from "services/client/memory";

test('single worker full capacity', () => {
    const snapshot: MemorySnapshot = {
        workers: [
            { hostname: 'h1', totalRam: 32, setAsideRam: 0, reservedRam: 0, allocatedRam: 0 },
        ],
        allocations: [],
    };
    expect(maxChunksForSnapshot(snapshot, 4)).toBe(8);
});

test('accounts for reserved memory', () => {
    const snapshot: MemorySnapshot = {
        workers: [
            { hostname: 'h1', totalRam: 16, setAsideRam: 4, reservedRam: 4, allocatedRam: 4 },
        ],
        allocations: [],
    };
    expect(maxChunksForSnapshot(snapshot, 4)).toBe(1);
});

test('multiple workers sum capacity', () => {
    const snapshot: MemorySnapshot = {
        workers: [
            { hostname: 'a', totalRam: 8, setAsideRam: 0, reservedRam: 0, allocatedRam: 0 },
            { hostname: 'b', totalRam: 10, setAsideRam: 1, reservedRam: 1, allocatedRam: 2 },
        ],
        allocations: [],
    };
    expect(maxChunksForSnapshot(snapshot, 3)).toBe(4);
});
