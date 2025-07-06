import type { NS } from "netscript";
import {
    assert,
    assertAlmostEquals,
    assertEquals,
} from "https://deno.land/std/assert/mod.ts";

import { MemoryAllocator } from "services/allocator";

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

Deno.test('allocate and release', () => {
    const hosts = { h1: { max: 32, used: 0 }, h2: { max: 16, used: 0 } };
    const procs: ProcMap = { 1: true };
    const ns = makeNS(hosts, procs);
    const alloc = new MemoryAllocator(ns);
    alloc.pushWorker('h1');
    alloc.pushWorker('h2');

    const res = alloc.allocate(1, 'test.js', 8, 3);
    assert(res !== null);
    assertEquals(res!.hosts.length, 1);
    assertAlmostEquals(alloc.getFreeRamTotal(), 24);
    assertEquals(alloc.deallocate(res!.allocationId, 1, 'h1'), true);
    assertAlmostEquals(alloc.getFreeRamTotal(), 48);
});

Deno.test('claim and release chunks', () => {
    const hosts = { h1: { max: 32, used: 0 } };
    const procs: ProcMap = { 1: true, 2: true };
    const ns = makeNS(hosts, procs);
    const alloc = new MemoryAllocator(ns);
    alloc.pushWorker('h1');

    const res = alloc.allocate(1, 'a.js', 4, 4);
    assert(res !== null);
    const claimOk = alloc.claimAllocation({ allocationId: res!.allocationId, pid: 2, hostname: 'h1', filename: 'b.js', chunkSize: 4, numChunks: 2 });
    assertEquals(claimOk, true);
    assert(alloc.releaseChunks(res!.allocationId, 2) !== null);
    assertAlmostEquals(alloc.getFreeRamTotal(), 32 - 8);
    assertEquals(alloc.deallocate(res!.allocationId, 1, 'h1'), true);
    assertAlmostEquals(alloc.getFreeRamTotal(), 32);
});

Deno.test('garbage collect terminated processes', () => {
    const hosts = { h1: { max: 16, used: 0 } };
    const procs: ProcMap = { 1: false };
    const ns = makeNS(hosts, procs);
    const alloc = new MemoryAllocator(ns);
    alloc.pushWorker('h1');

    const res = alloc.allocate(1, 'dead.js', 4, 2);
    assert(res !== null);
    alloc.cleanupTerminated();
    assertAlmostEquals(alloc.getFreeRamTotal(), 16);
});

Deno.test('contiguous vs non-contiguous allocation', () => {
    const hosts = { h1: { max: 16, used: 0 }, h2: { max: 8, used: 0 } };
    const ns = makeNS(hosts, {});
    const alloc = new MemoryAllocator(ns);
    alloc.pushWorker('h1');
    alloc.pushWorker('h2');

    const contig = alloc.allocate(1, 'c.js', 4, 3, true);
    assertEquals(contig!.hosts.length, 1);
    assertEquals(contig!.hosts[0].hostname, 'h1');
    alloc.deallocate(contig!.allocationId, 1, 'h1');
    const split = alloc.allocate(1, 'c.js', 4, 6, true);
    assert(split !== null);
    assertEquals(split!.hosts.length, 2);
});

Deno.test('core dependent prioritizes home', () => {
    const hosts = { home: { max: 8, used: 0 }, h1: { max: 16, used: 0 } };
    const ns = makeNS(hosts, {});
    const alloc = new MemoryAllocator(ns);
    alloc.pushWorker('home');
    alloc.pushWorker('h1');

    const normal = alloc.allocate(1, 'd.js', 4, 1);
    assertEquals(normal!.hosts[0].hostname, 'h1');
    const core = alloc.allocate(1, 'd.js', 4, 1, false, true);
    assertEquals(core!.hosts[0].hostname, 'home');
});

Deno.test('shrinkable allocation uses partial capacity', () => {
    const hosts = { h1: { max: 16, used: 0 }, h2: { max: 8, used: 0 } };
    const ns = makeNS(hosts, {});
    const alloc = new MemoryAllocator(ns);
    alloc.pushWorker('h1');
    alloc.pushWorker('h2');

    const res = alloc.allocate(1, 'e.js', 4, 8, false, false, true);
    assert(res !== null);
    const total = res!.hosts.reduce((s, h) => s + h.numChunks, 0);
    assertEquals(total, 6);
});

Deno.test('updateReserved adjusts reserved RAM', () => {
    const hosts = { h1: { max: 32, used: 0 } };
    const ns = makeNS(hosts, {});
    const alloc = new MemoryAllocator(ns);
    alloc.pushWorker('h1');

    const res = alloc.allocate(1, 'f.js', 4, 4);
    assert(res !== null);
    hosts.h1.used = 20;
    alloc.updateReserved();
    const worker = Array.from(alloc.workers.values())[0];
    assertEquals(worker.reservedRam, BigInt(400));
});

Deno.test('edge cases', () => {
    const hosts = { h1: { max: 16, used: 0 } };
    const ns = makeNS(hosts, {});
    const alloc = new MemoryAllocator(ns);
    alloc.pushWorker('h1');

    assertEquals(alloc.deallocate(999, 1, 'h1'), false);
    const res = alloc.allocate(1, 'g.js', 4, 2);
    assert(res !== null);
    assertEquals(alloc.releaseChunks(res!.allocationId, 5), null);
    assertEquals(alloc.claimAllocation({ allocationId: res!.allocationId, pid: 1, hostname: 'h1', filename: 'g.js', chunkSize: 4, numChunks: 3 }), false);
});
