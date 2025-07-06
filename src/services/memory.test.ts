import { MemoryAllocator } from "./memory";
import type { NS } from "netscript";

function createNs(hosts: Record<string, { maxRam: number; usedRam?: number }>): NS {
    return {
        getServerMaxRam: (h: string) => hosts[h]?.maxRam ?? 0,
        getServerUsedRam: (h: string) => hosts[h]?.usedRam ?? 0,
        formatRam: (v: number) => `${v}`,
    } as unknown as NS;
}

function setupAllocator() {
    const hosts = { a: { maxRam: 10 }, b: { maxRam: 6 } };
    const ns = createNs(hosts);
    const alloc = new MemoryAllocator(ns);
    alloc.pushWorker("a");
    alloc.pushWorker("b");
    return { alloc, hosts };
}

test("allocates across multiple workers", () => {
    const { alloc } = setupAllocator();
    const result = alloc.allocate(1, "x.js", 2, 7);
    expect(result).not.toBeNull();
    expect(result!.hosts).toEqual([
        { hostname: "a", chunkSize: 2, numChunks: 5 },
        { hostname: "b", chunkSize: 2, numChunks: 2 },
    ]);
    expect(alloc.getFreeRamTotal()).toBeCloseTo(2);
});

test("deallocate frees all chunks for owner", () => {
    const { alloc } = setupAllocator();
    const result = alloc.allocate(2, "a.js", 2, 7)!;
    expect(alloc.deallocate(result.allocationId, 2, ""));
    expect(alloc.getFreeRamTotal()).toBeCloseTo(16);
    expect(alloc["allocations"].size).toBe(0);
});

test("releaseChunks shrinks allocation", () => {
    const { alloc } = setupAllocator();
    const result = alloc.allocate(3, "b.js", 2, 7)!;
    const updated = alloc.releaseChunks(result.allocationId, 3);
    expect(updated).not.toBeNull();
    expect(updated!.hosts).toEqual([
        { hostname: "a", chunkSize: 2, numChunks: 4 },
    ]);
    expect(alloc.getFreeRamTotal()).toBeCloseTo(8);
});

test("claims can be released independently", () => {
    const { alloc } = setupAllocator();
    const result = alloc.allocate(4, "c.js", 2, 6)!;
    const claim = {
        allocationId: result.allocationId,
        pid: 99,
        hostname: "a",
        filename: "c.js",
        chunkSize: 2,
        numChunks: 2,
    };
    expect(alloc.claimAllocation(claim)).toBe(true);
    expect(alloc.deallocate(result.allocationId, 99, "a")).toBe(true);
    const remaining = alloc["allocations"].get(result.allocationId)!;
    expect(remaining.chunks).toEqual([
        { hostname: "a", chunkSize: 2, numChunks: 3 },
        { hostname: "b", chunkSize: 2, numChunks: 1 },
    ]);
    expect(remaining.claims.length).toBe(0);
});
