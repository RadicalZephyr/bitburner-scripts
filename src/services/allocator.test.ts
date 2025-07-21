import type { NS, ProcessInfo } from 'netscript';

import { expect, test } from '@jest/globals';

import { MemoryAllocator } from './allocator';

type ProcMap = Record<number, boolean>;

type HostInfo = { max: number; used: number };

type HostMap = Record<string, HostInfo>;

type ProcList = Record<string, ProcessInfo[]>;

type FileMap = Record<string, number>;

function makeNS(
  hosts: HostMap,
  procs: ProcMap,
  purchased: string[] = [],
  psMap: ProcList = {},
  files: FileMap = {},
): NS {
  return {
    getScriptRam: (f: string) => files[f] ?? 0,
    getServerMaxRam: (h: string) => hosts[h].max,
    getServerUsedRam: (h: string) => hosts[h].used,
    isRunning: (pid: number) => procs[pid] ?? false,
    ps: (host?: string) => (host ? (psMap[host] ?? []) : []),
    formatRam: (ram: number) => `${ram}`,
    getPurchasedServers: () => purchased,
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
  const claimOk = alloc.claimAllocation({
    allocationId: res!.allocationId,
    pid: 2,
    hostname: 'h1',
    filename: 'b.js',
    chunkSize: 4,
    numChunks: 2,
  });
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

test('longRunning prefers non-purchased servers', () => {
  const hosts = {
    home: { max: 8, used: 0 },
    n1: { max: 16, used: 0 },
    p1: { max: 16, used: 0 },
  };
  const ns = makeNS(hosts, {}, ['p1']);
  const alloc = new MemoryAllocator(ns);
  alloc.pushWorker('home');
  alloc.pushWorker('n1');
  alloc.pushWorker('p1');

  const res = alloc.allocate(1, 'lr.js', 4, 1, false, false, false, true);
  expect(res!.hosts[0].hostname).toBe('n1');
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
  const psMap = {
    h1: [
      {
        filename: 'x.js',
        threads: 1,
        args: [],
        pid: 99,
        temporary: false,
        parent: 0,
        server: 'h1',
        tailProperties: null,
      } as unknown as ProcessInfo,
    ],
  };
  const files = { 'x.js': 4 };
  const ns = makeNS(hosts, {}, [], psMap, files);
  const alloc = new MemoryAllocator(ns);
  alloc.pushWorker('h1');

  const res = alloc.allocate(1, 'f.js', 4, 4);
  expect(res).not.toBeNull();
  hosts.h1.used = 20;
  alloc.updateReserved();
  const worker = Array.from(alloc.workers.values())[0];
  expect(worker.reservedRam).toBe(BigInt(400));
});

test('allocation fails when insufficient RAM', () => {
  const hosts = { h1: { max: 8, used: 0 }, h2: { max: 4, used: 0 } };
  const ns = makeNS(hosts, {});
  const alloc = new MemoryAllocator(ns);
  alloc.pushWorker('h1');
  alloc.pushWorker('h2');

  const res = alloc.allocate(1, 'fail.js', 4, 4);
  expect(res).toBeNull();
  expect(alloc.getFreeRamTotal()).toBeCloseTo(12);
});

test('releaseChunks across hosts updates state', () => {
  const hosts = { h1: { max: 16, used: 0 }, h2: { max: 16, used: 0 } };
  const procs: ProcMap = { 1: true, 2: true, 3: true };
  const ns = makeNS(hosts, procs);
  const alloc = new MemoryAllocator(ns);
  alloc.pushWorker('h1');
  alloc.pushWorker('h2');

  const res = alloc.allocate(1, 'multi.js', 4, 6);
  expect(res).not.toBeNull();
  const id = res!.allocationId;
  alloc.claimAllocation({
    allocationId: id,
    pid: 2,
    hostname: 'h1',
    filename: 'a.js',
    chunkSize: 4,
    numChunks: 1,
  });
  alloc.claimAllocation({
    allocationId: id,
    pid: 3,
    hostname: 'h2',
    filename: 'b.js',
    chunkSize: 4,
    numChunks: 1,
  });

  const after = alloc.releaseChunks(id, 3);
  expect(after).not.toBeNull();
  const snap = alloc.getSnapshot();
  expect(snap.allocations[0].hosts).toEqual([
    { hostname: 'h1', chunkSize: 4, numChunks: 3 },
  ]);
  expect(snap.allocations[0].claims.length).toBe(0);
  expect(alloc.getFreeRamTotal()).toBeCloseTo(20);
});

test('updateReserved reflects manual host usage changes', () => {
  const hosts = { h1: { max: 32, used: 0 } };
  const psMap: ProcList = {
    h1: [
      {
        filename: 'y.js',
        threads: 1,
        args: [],
        pid: 99,
        temporary: false,
        parent: 0,
        ramUsage: 4,
        server: 'h1',
        tailProperties: null,
      } as unknown as ProcessInfo,
    ],
  };
  const files = { 'y.js': 4 };
  const ns = makeNS(hosts, {}, [], psMap, files);
  const alloc = new MemoryAllocator(ns);
  alloc.pushWorker('h1');

  alloc.allocate(1, 'h.js', 4, 2);
  hosts.h1.used = 12;
  alloc.updateReserved();
  let worker = Array.from(alloc.workers.values())[0];
  expect(worker.reservedRam).toBe(BigInt(400));
  hosts.h1.used = 6;
  psMap.h1 = [];
  alloc.updateReserved();
  worker = Array.from(alloc.workers.values())[0];
  expect(worker.reservedRam).toBe(0n);
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
  expect(
    alloc.claimAllocation({
      allocationId: res!.allocationId,
      pid: 1,
      hostname: 'h1',
      filename: 'g.js',
      chunkSize: 4,
      numChunks: 3,
    }),
  ).toBe(false);
});

test('claim deallocation frees claimed memory', () => {
  const hosts = { h1: { max: 16, used: 0 } };
  const procs: ProcMap = { 1: true, 2: true };
  const ns = makeNS(hosts, procs);
  const alloc = new MemoryAllocator(ns);
  alloc.pushWorker('h1');

  const res = alloc.allocate(1, 'claim.js', 4, 4);
  expect(res).not.toBeNull();
  const id = res!.allocationId;
  expect(
    alloc.claimAllocation({
      allocationId: id,
      pid: 2,
      hostname: 'h1',
      filename: 'c.js',
      chunkSize: 4,
      numChunks: 2,
    }),
  ).toBe(true);

  expect(alloc.releaseClaim(id, 2, 'h1')).toBe(true);
  const snap = alloc.getSnapshot();
  expect(snap.allocations[0].hosts).toEqual([
    { hostname: 'h1', chunkSize: 4, numChunks: 2 },
  ]);
  expect(snap.allocations[0].claims.length).toBe(0);
  expect(alloc.getFreeRamTotal()).toBeCloseTo(8);
});

test('releaseChunks trims claims across hosts', () => {
  const hosts = { h1: { max: 16, used: 0 }, h2: { max: 16, used: 0 } };
  const procs: ProcMap = { 1: true, 2: true, 3: true };
  const ns = makeNS(hosts, procs);
  const alloc = new MemoryAllocator(ns);
  alloc.pushWorker('h1');
  alloc.pushWorker('h2');

  const res = alloc.allocate(1, 'rel.js', 4, 6);
  expect(res).not.toBeNull();
  const id = res!.allocationId;
  alloc.claimAllocation({
    allocationId: id,
    pid: 2,
    hostname: 'h1',
    filename: 'a.js',
    chunkSize: 4,
    numChunks: 2,
  });
  alloc.claimAllocation({
    allocationId: id,
    pid: 3,
    hostname: 'h2',
    filename: 'b.js',
    chunkSize: 4,
    numChunks: 2,
  });

  const after = alloc.releaseChunks(id, 3);
  expect(after).not.toBeNull();
  const snap = alloc.getSnapshot();
  expect(snap.allocations[0].hosts).toEqual([
    { hostname: 'h1', chunkSize: 4, numChunks: 3 },
  ]);
  expect(snap.allocations[0].claims).toEqual([
    { pid: 2, hostname: 'h1', filename: 'a.js', chunkSize: 4, numChunks: 1 },
  ]);
  expect(alloc.getFreeRamTotal()).toBeCloseTo(20);
});

test('releaseChunks freeing all memory removes allocation', () => {
  const hosts = { h1: { max: 16, used: 0 } };
  const procs: ProcMap = { 1: true, 2: true };
  const ns = makeNS(hosts, procs);
  const alloc = new MemoryAllocator(ns);
  alloc.pushWorker('h1');

  const res = alloc.allocate(1, 'full.js', 4, 2);
  expect(res).not.toBeNull();
  const id = res!.allocationId;
  alloc.claimAllocation({
    allocationId: id,
    pid: 2,
    hostname: 'h1',
    filename: 'c.js',
    chunkSize: 4,
    numChunks: 1,
  });

  expect(alloc.releaseChunks(id, 2)).toBeNull();
  expect(alloc.getSnapshot().allocations.length).toBe(0);
  expect(alloc.getFreeRamTotal()).toBeCloseTo(16);
});

test('claim fails on unknown host chunk', () => {
  const hosts = { h1: { max: 16, used: 0 } };
  const ns = makeNS(hosts, {});
  const alloc = new MemoryAllocator(ns);
  alloc.pushWorker('h1');

  const res = alloc.allocate(1, 'bad.js', 4, 2);
  expect(res).not.toBeNull();
  const result = alloc.claimAllocation({
    allocationId: res!.allocationId,
    pid: 1,
    hostname: 'h2',
    filename: 'a.js',
    chunkSize: 4,
    numChunks: 1,
  });
  expect(result).toBe(false);
});

test('registerAllocation converts reserved to allocated', () => {
  const hosts = { h1: { max: 16, used: 4 } };
  const ns = makeNS(hosts, {});
  const alloc = new MemoryAllocator(ns);
  alloc.pushWorker('h1');

  const res = alloc.registerAllocation({
    pid: 1,
    hostname: 'h1',
    filename: 'mem.js',
    chunkSize: 4,
    numChunks: 1,
  });
  expect(res).not.toBeNull();
  const worker = Array.from(alloc.workers.values())[0];
  expect(worker.allocatedRam).toBe(BigInt(400));
  expect(worker.reservedRam).toBe(0n);
});

test('releaseChunks clamps requestedChunks to zero', () => {
  const hosts = { h1: { max: 32, used: 0 } };
  const ns = makeNS(hosts, {});
  const alloc = new MemoryAllocator(ns);
  alloc.pushWorker('h1');

  const res = alloc.allocate(1, 'clamp.js', 4, 2);
  expect(res).not.toBeNull();
  const id = res!.allocationId;
  const allocation = alloc.allocations.get(id)!;
  // Grow the allocation without updating requestedChunks
  alloc.growAllocation(allocation, 2);

  const after = alloc.releaseChunks(id, 3);
  expect(after).not.toBeNull();
  const updated = alloc.allocations.get(id)!;
  expect(updated.requestedChunks).toBe(0);
});
