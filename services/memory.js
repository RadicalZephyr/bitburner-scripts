import { parseFlags } from 'util/flags';
import { MEMORY_PORT, MemoryProtocol, MessageType, MEMORY_RESPONSE_PORT, } from 'services/client/memory';
import { DiscoveryClient } from 'services/client/discover';
import { fromFixed, MemoryAllocator } from 'services/allocator';
import { withPlugins } from 'ns/extend';
import { loggerPlugin } from 'ns/plugins/logger';
import { UI_CONFIG } from 'ui/config';
import { HUD_HEIGHT, HUD_WIDTH, STATUS_WINDOW_WIDTH } from 'ui/constants';
import { useNsUpdate, useTheme } from 'ui/hooks';
import { BaseServer } from 'util/protocol';
import { LogRoot } from 'ui/LogRoot';
import { React } from 'lib/react';
import { CONFIG } from 'services/config';
const FLAGS = [
    ['refresh-rate', 1000],
    ['help', false],
];
export function autocomplete(data) {
    data.flags(FLAGS);
    return [];
}
function extendNs(ns) {
    const bufferCap = 500;
    return withPlugins(ns, loggerPlugin(bufferCap));
}
export async function main(ns) {
    const flags = await parseFlags(ns, FLAGS);
    const refreshRate = flags['refresh-rate'];
    const rest = flags._;
    if (rest.length !== 0 || flags.help || typeof refreshRate != 'number') {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

This script handles allocating blocks of memory. A visualization of the
reserved, allocated and free memory for each Worker host can be viewed in
this script's log.

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --help           Show this help message
  --refresh-rate   Time to sleep between displaying memory usage

CONFIGURATION
  SERVICE_memoryGrowCheckRateMs  Length of time between attempting to grow undersized allocations
  SERVICE_memResponseTimeoutMs   How long to attempt to send responses while response port is full
`);
        return;
    }
    ns.disableLog('ALL');
    ns.ui.setTailTitle('Memory Allocator');
    if (UI_CONFIG.openHUD) {
        ns.ui.openTail();
        ns.ui.resizeTail(HUD_WIDTH / 2, HUD_HEIGHT);
        const [ww] = ns.ui.windowSize();
        ns.ui.moveTail(ww - (1.5 * HUD_WIDTH + STATUS_WINDOW_WIDTH), 0);
    }
    const nsx = extendNs(ns);
    const buffer = nsx.getLogBuffer();
    await startMemoryAllocator(nsx, buffer);
}
async function startMemoryAllocator(ns, log) {
    const memoryManager = new MemoryAllocator(ns);
    ns.print(`INFO: starting memory manager on ${ns.self().server}`);
    if (ns.getServerMaxRam('home') > 32) {
        memoryManager.pushWorker('home', 32);
    }
    else {
        memoryManager.pushWorker('home', 8);
    }
    const discoveryClient = new DiscoveryClient(ns);
    ns.print(`INFO: requesting workers from Discover service`);
    const workers = await discoveryClient.requestWorkers({
        messageType: MessageType.Worker,
        port: MEMORY_PORT,
    });
    ns.print(`INFO: received workers from Discover service: ${workers.join(', ')}`);
    for (const worker of workers) {
        memoryManager.pushWorker(worker);
    }
    // Register this script's memory usage
    const self = ns.self();
    memoryManager.registerAllocation({
        pid: self.pid,
        hostname: self.server,
        filename: self.filename,
        chunkSize: self.ramUsage,
        numChunks: 1,
    });
    const server = new Server(ns, memoryManager);
    void server.readLoop();
    let lastCollection = Date.now();
    let lastGrowCheck = 0;
    function getWorkers() {
        const purchasedServers = new Set(ns.getPurchasedServers());
        function compareWorkers(a, b) {
            if (a.hostname === 'home')
                return -1;
            else if (b.hostname === 'home')
                return 1;
            else if (purchasedServers.has(a.hostname)
                && purchasedServers.has(b.hostname))
                return a.hostname.localeCompare(b.hostname);
            else if (purchasedServers.has(a.hostname))
                return -1;
            else if (purchasedServers.has(b.hostname))
                return 1;
            else if (a.hostname.startsWith('hacknet-server-')
                && b.hostname.startsWith('hacknet-server-'))
                return a.hostname.localeCompare(b.hostname);
            else if (a.hostname.startsWith('hacknet-server-'))
                return -1;
            else if (b.hostname.startsWith('hacknet-server-'))
                return 1;
            return 0;
        }
        const workers = Array.from(memoryManager.workers.values());
        workers.sort(compareWorkers);
        return workers;
    }
    ns.clearLog();
    ns.printRaw(React.createElement(LogRoot, { ns: ns, buffer: log },
        React.createElement(MemoryDisplay, { ns: ns, getWorkers: getWorkers })));
    while (true) {
        const now = Date.now();
        memoryManager.checkHomeForRamIncrease();
        if (lastCollection + CONFIG.garbageCollectionRateMs < now) {
            memoryManager.updateReserved();
            memoryManager.cleanupTerminated();
            lastCollection = now;
        }
        if (lastGrowCheck + CONFIG.memoryGrowCheckRateMs < now) {
            await growAllocations(ns, memoryManager);
            lastGrowCheck = now;
        }
        await ns.asleep(50);
    }
}
class Server extends BaseServer {
    constructor(ns, memoryManager) {
        const requestPort = ns.getPortHandle(MEMORY_PORT);
        const responsePort = ns.getPortHandle(MEMORY_RESPONSE_PORT);
        const handlers = {
            [MessageType.Worker]: (hostPayload) => {
                const hosts = Array.isArray(hostPayload)
                    ? hostPayload
                    : [hostPayload];
                for (const h of hosts) {
                    memoryManager.pushWorker(h);
                }
                return Promise.resolve();
            },
            [MessageType.AllocationRequest]: (request) => {
                ns.print(`INFO: request pid=${request.pid} filename=${request.filename} `
                    + `${request.numChunks}x${ns.formatRam(request.chunkSize)} `
                    + `contiguous=${request.contiguous ?? false} `
                    + `coreDependent=${request.coreDependent ?? false} `
                    + `longRunning=${request.longRunning ?? false}`);
                const allocation = memoryManager.allocate(request.pid, request.filename, request.chunkSize, request.numChunks, request.contiguous ?? false, request.coreDependent ?? false, request.shrinkable ?? false, request.longRunning ?? false);
                if (allocation) {
                    ns.print(`SUCCESS: allocated id ${allocation.allocationId} `
                        + `across ${allocation.hosts.length} hosts`);
                }
                else {
                    ns.print('WARN: allocation failed, not enough space');
                }
                return Promise.resolve(allocation);
            },
            [MessageType.GrowableRequest]: (growReq) => {
                ns.print(`INFO: growable request pid=${growReq.pid} filename=${growReq.filename} `
                    + `${growReq.numChunks}x${ns.formatRam(growReq.chunkSize)}`);
                const growAlloc = memoryManager.allocate(growReq.pid, growReq.filename, growReq.chunkSize, growReq.numChunks, growReq.contiguous ?? false, growReq.coreDependent ?? false, growReq.shrinkable ?? true, growReq.longRunning ?? false, growReq.port);
                if (growAlloc) {
                    ns.print(`SUCCESS: allocated id ${growAlloc.allocationId} `
                        + `across ${growAlloc.hosts.length} hosts`);
                }
                else {
                    ns.print('WARN: growable allocation failed');
                }
                return Promise.resolve(growAlloc);
            },
            [MessageType.Release]: (release) => {
                if (memoryManager.deallocate(release.allocationId, release.pid, release.hostname)) {
                    ns.print(`SUCCESS: released allocation ${release.allocationId} `
                        + `pid=${release.pid} host=${release.hostname}`);
                }
                else {
                    ns.print(`WARN: allocation ${release.allocationId} not found for pid ${release.pid}`);
                }
                return Promise.resolve();
            },
            [MessageType.ClaimRelease]: (claimRel) => {
                if (memoryManager.releaseClaim(claimRel.allocationId, claimRel.pid, claimRel.hostname)) {
                    ns.print(`SUCCESS: released claim for ${claimRel.allocationId} `
                        + `pid=${claimRel.pid} host=${claimRel.hostname}`);
                }
                else {
                    ns.print(`WARN: claim for allocation ${claimRel.allocationId} not found for pid ${claimRel.pid}`);
                }
                return Promise.resolve();
            },
            [MessageType.Register]: (reg) => {
                ns.print(`INFO: register pid=${reg.pid} host=${reg.hostname} `
                    + `${reg.numChunks}x${ns.formatRam(reg.chunkSize)} `
                    + `${reg.filename}`);
                memoryManager.registerAllocation(reg);
                return Promise.resolve();
            },
            [MessageType.Status]: () => {
                return Promise.resolve({
                    freeRam: memoryManager.getFreeRamTotal(),
                    chunks: memoryManager.getFreeChunks(),
                });
            },
            [MessageType.Snapshot]: () => {
                ns.print(`INFO: processing snapshot request`);
                return Promise.resolve(memoryManager.getSnapshot());
            },
            [MessageType.Claim]: (claimInfo) => {
                if (memoryManager.claimAllocation(claimInfo)) {
                    ns.print(`INFO: claimed allocation ${claimInfo.allocationId} `
                        + `pid=${claimInfo.pid} host=${claimInfo.hostname} `
                        + `${claimInfo.numChunks}x${ns.formatRam(claimInfo.chunkSize)} `
                        + `${claimInfo.filename}`);
                }
                else {
                    ns.print(`WARN: failed to claim allocation ${claimInfo.allocationId}`);
                }
                return Promise.resolve();
            },
        };
        super(ns, MemoryProtocol, requestPort, responsePort, handlers);
    }
}
async function growAllocations(ns, memoryManager) {
    if (memoryManager.getFreeRamTotal() <= 0)
        return;
    for (const alloc of memoryManager.allocations.values()) {
        if (alloc.notifyPort === undefined)
            continue;
        const current = alloc.chunks.reduce((s, c) => s + c.numChunks, 0);
        const missing = alloc.requestedChunks - current;
        if (missing <= 0)
            continue;
        const newChunks = memoryManager.growAllocation(alloc, missing);
        if (newChunks.length === 0)
            continue;
        const firstChunk = newChunks[0];
        const host = firstChunk.hostname;
        const chunkSize = ns.formatRam(firstChunk?.chunkSize ?? 0);
        const totalChunks = newChunks.reduce((s, c) => s + c.numChunks, 0);
        ns.print(`INFO: growing allocation ${alloc.id} by ${totalChunks}x${chunkSize} from ${host}`);
        const port = ns.getPortHandle(alloc.notifyPort);
        while (!port.tryWrite(newChunks)) {
            await ns.asleep(20);
        }
    }
}
/**
 * Display memory usage for each worker host.
 *
 * @param manager - The allocator to read usage from.
 * @param theme - The UI theme.
 */
function MemoryDisplay({ ns, getWorkers }) {
    const theme = useTheme(ns, 200);
    const workers = useNsUpdate(ns, 200, getWorkers);
    const cellStyle = { padding: '0 0.5em' };
    return (React.createElement("div", { style: { fontFamily: 'monospace' } },
        React.createElement("table", null,
            React.createElement("tbody", null, workers.map((w, idx) => (React.createElement(MemoryRow, { worker: w, theme: theme, rowIndex: idx, cellStyle: cellStyle })))))));
}
function MemoryRow({ worker, rowIndex, cellStyle, theme }) {
    return (React.createElement("tr", { key: worker.hostname, style: rowIndex % 2 === 1 ? { backgroundColor: theme.well } : undefined },
        React.createElement("td", { style: { ...cellStyle, textAlign: 'left' } }, worker.hostname),
        React.createElement("td", { style: { ...cellStyle, textAlign: 'right' } }, worker.totalRamStr),
        React.createElement("td", { style: { ...cellStyle, textAlign: 'right', minWidth: '215px' } },
            "[",
            React.createElement(MemoryBar, { worker: worker, theme: theme }),
            "]")));
}
function MemoryBar({ worker, theme }) {
    const segments = 20;
    const setAside = fromFixed(worker.setAsideRam);
    const reserved = fromFixed(worker.reservedRam);
    const allocated = fromFixed(worker.allocatedRam);
    const setAsideSeg = calculateBarSegments(setAside, worker.totalRam, segments);
    const reservedSeg = calculateBarSegments(reserved, worker.totalRam, segments);
    const allocSeg = calculateBarSegments(allocated, worker.totalRam, segments);
    const usedSeg = Math.min(segments, setAsideSeg + reservedSeg + allocSeg);
    const freeSeg = segments - usedSeg;
    const setAsideBar = '|'.repeat(setAsideSeg);
    const reservedBar = '|'.repeat(reservedSeg);
    const allocBar = '|'.repeat(allocSeg);
    const freeBar = '-'.repeat(freeSeg);
    return (React.createElement(React.Fragment, null,
        React.createElement("span", { key: "s", style: { color: theme.infolight } }, setAsideBar),
        React.createElement("span", { key: "r", style: { color: theme.hp } }, reservedBar),
        React.createElement("span", { key: "a", style: { color: theme.money } }, allocBar),
        React.createElement("span", null, freeBar)));
}
function calculateBarSegments(segmentRam, totalRam, segments) {
    if (segmentRam > 1 && totalRam > 0) {
        const numSegments = (segmentRam / totalRam) * segments;
        return numSegments > 0 && numSegments < 1 ? 1 : Math.round(numSegments);
    }
    else {
        return 0;
    }
}
