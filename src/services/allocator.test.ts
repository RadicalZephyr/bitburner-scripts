import type { NS } from "netscript";

import { MemoryAllocator } from "./allocator";

type ProcMap = Record<number, boolean>;

type HostInfo = { max: number; used: number };

type HostMap = Record<string, HostInfo>;

function makeNS(hosts: HostMap, procs: ProcMap): NS {
    return {
        getServerMaxRam: (h: string) => hosts[h].max,
        getServerUsedRam: (h: string) => hosts[h].used,
        isRunning: (pid: number) => procs[pid] ?? false,
        formatRam: (ram: number) => `${ram}`,
    } as unknown as NS;
}

test('allocate and release', () => {
    const hosts = { h1: { max: 32, used: 0 }, h2: { max: 16, used: 0 } };
    const procs: ProcMap = { 1: true };
    const ns = makeNS(hosts, procs);
    const alloc = new MemoryAllocator(ns);
    alloc.pushWorker('h1');
    alloc.pushWorker('h2');
    const res = alloc.allocate(1, 'test.js', 8, 3);
    expect(res).not.toBeNull();
    expect(res!.hosts.length).toBe(1);
    expect(alloc.getFreeRamTotal()).toBeCloseTo(24);
    expect(alloc.deallocate(res!.allocationId, 1, 'h1')).toBe(true);
    expect(alloc.getFreeRamTotal()).toBeCloseTo(48);
});

test('claim and release chunks', () => {
    const hosts = { h1: { max: 32, used: 0 } };
    const procs: ProcMap = { 1: true, 2: true };
    const ns = makeNS(hosts, procs);
    const alloc = new MemoryAllocator(ns);
    alloc.pushWorker('h1');
    const res = alloc.allocate(1, 'a.js', 4, 4);
    expect(res).not.toBeNull();
    const claimOk = alloc.claimAllocation({ allocationId: res!.allocationId, pid: 2, hostname: 'h1', filename: 'b.js', chunkSize: 4, numChunks: 2 });
    expect(claimOk).toBe(true);
    expect(alloc.releaseChunks(res!.allocationId, 2)).not.toBeNull();
    expect(alloc.getFreeRamTotal()).toBeCloseTo(32 - 8);
    expect(alloc.deallocate(res!.allocationId, 1, 'h1')).toBe(true);
    expect(alloc.getFreeRamTotal()).toBeCloseTo(32);
});

test('garbage collect terminated processes', () => {
    const hosts = { h1: { max: 16, used: 0 } };
    const procs: ProcMap = { 1: false };
    const ns = makeNS(hosts, procs);
    const alloc = new MemoryAllocator(ns);
    alloc.pushWorker('h1');
    const res = alloc.allocate(1, 'dead.js', 4, 2);
    expect(res).not.toBeNull();
    alloc.cleanupTerminated();
    expect(alloc.getFreeRamTotal()).toBeCloseTo(16);
});
