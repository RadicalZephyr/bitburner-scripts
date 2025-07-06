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

test('contiguous vs non-contiguous allocation', () => {
    const hosts = { h1: { max: 16, used: 0 }, h2: { max: 8, used: 0 } };
    const ns = makeNS(hosts, {});
    const alloc = new MemoryAllocator(ns);
    alloc.pushWorker('h1');
    alloc.pushWorker('h2');

    const contig = alloc.allocate(1, 'c.js', 4, 3, true);
    expect(contig!.hosts.length).toBe(1);
    expect(contig!.hosts[0].hostname).toBe('h1');
    alloc.deallocate(contig!.allocationId, 1, 'h1');
    const split = alloc.allocate(1, 'c.js', 4, 6, true);
    expect(split).not.toBeNull();
    expect(split!.hosts.length).toBe(2);
});

test('core dependent prioritizes home', () => {
    const hosts = { home: { max: 8, used: 0 }, h1: { max: 16, used: 0 } };
    const ns = makeNS(hosts, {});
    const alloc = new MemoryAllocator(ns);
    alloc.pushWorker('home');
    alloc.pushWorker('h1');

    const normal = alloc.allocate(1, 'd.js', 4, 1);
    expect(normal!.hosts[0].hostname).toBe('h1');
    const core = alloc.allocate(1, 'd.js', 4, 1, false, true);
    expect(core!.hosts[0].hostname).toBe('home');
});

test('shrinkable allocation uses partial capacity', () => {
    const hosts = { h1: { max: 16, used: 0 }, h2: { max: 8, used: 0 } };
    const ns = makeNS(hosts, {});
    const alloc = new MemoryAllocator(ns);
    alloc.pushWorker('h1');
    alloc.pushWorker('h2');

    const res = alloc.allocate(1, 'e.js', 4, 8, false, false, true);
    expect(res).not.toBeNull();
    const total = res!.hosts.reduce((s, h) => s + h.numChunks, 0);
    expect(total).toBe(6);
});

test('updateReserved adjusts reserved RAM', () => {
    const hosts = { h1: { max: 32, used: 0 } };
    const ns = makeNS(hosts, {});
    const alloc = new MemoryAllocator(ns);
    alloc.pushWorker('h1');

    const res = alloc.allocate(1, 'f.js', 4, 4);
    expect(res).not.toBeNull();
    hosts.h1.used = 20;
    alloc.updateReserved();
    const worker = Array.from(alloc.workers.values())[0];
    expect(worker.reservedRam).toBe(BigInt(400));
});

test('edge cases', () => {
    const hosts = { h1: { max: 16, used: 0 } };
    const ns = makeNS(hosts, {});
    const alloc = new MemoryAllocator(ns);
    alloc.pushWorker('h1');

    expect(alloc.deallocate(999, 1, 'h1')).toBe(false);
    const res = alloc.allocate(1, 'g.js', 4, 2);
    expect(res).not.toBeNull();
    expect(alloc.releaseChunks(res!.allocationId, 5)).toBeNull();
    expect(alloc.claimAllocation({ allocationId: res!.allocationId, pid: 1, hostname: 'h1', filename: 'g.js', chunkSize: 4, numChunks: 3 })).toBe(false);
});
