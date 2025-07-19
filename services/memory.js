import { ALLOC_ID, MEM_TAG_FLAGS } from "services/client/memory_tag";
import { parseAndRegisterAlloc } from "services/client/memory";
import { MEMORY_PORT, MessageType, MEMORY_RESPONSE_PORT, } from "services/client/memory";
import { DiscoveryClient } from "services/client/discover";
import { fromFixed, MemoryAllocator } from "services/allocator";
import { readAllFromPort } from "util/ports";
import { HUD_HEIGHT, HUD_WIDTH, STATUS_WINDOW_WIDTH } from "util/ui";
let printLog;
export async function main(ns) {
    const flags = ns.flags([
        ['refresh-rate', 1000],
        ['help', false],
        ...MEM_TAG_FLAGS
    ]);
    let refreshRate = flags['refresh-rate'];
    const rest = flags._;
    if (rest.length !== 0 || flags.help || typeof refreshRate != 'number') {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

This script handles allocating blocks of memory. A visualization of the
reserved, allocated and free memory for each Worker host can be viewed in
this script's log.

OPTIONS
--help           Show this help message
--refresh-rate   Time to sleep between displaying memory usage

Example:

> run ${ns.getScriptName()}
`);
        return;
    }
    const allocationId = await parseAndRegisterAlloc(ns, flags);
    if (flags[ALLOC_ID] !== -1 && allocationId === null) {
        return;
    }
    ns.disableLog("ALL");
    ns.ui.openTail();
    ns.ui.setTailTitle("Memory Allocator");
    ns.ui.resizeTail(HUD_WIDTH, HUD_HEIGHT);
    const [ww, wh] = ns.ui.windowSize();
    ns.ui.moveTail(ww - ((2 * HUD_WIDTH) + STATUS_WINDOW_WIDTH), 0);
    const log = [];
    const maxLog = 72;
    printLog = (msg) => {
        log.push(msg);
        if (log.length > maxLog) {
            log.shift();
        }
    };
    let memPort = ns.getPortHandle(MEMORY_PORT);
    let memResponsePort = ns.getPortHandle(MEMORY_RESPONSE_PORT);
    let memMessageWaiting = true;
    memPort.nextWrite().then(_ => { memMessageWaiting = true; });
    let memoryManager = new MemoryAllocator(ns, printLog);
    printLog(`INFO: starting memory manager on ${ns.self().server}`);
    if (ns.getServerMaxRam("home") > 32) {
        memoryManager.pushWorker("home", 32);
    }
    else {
        memoryManager.pushWorker("home", 8);
    }
    let discoveryClient = new DiscoveryClient(ns);
    printLog(`INFO: requesting workers from Discover service`);
    let workers = await discoveryClient.requestWorkers({ messageType: MessageType.Worker, port: MEMORY_PORT });
    printLog(`INFO: received workers from Discover service: ${workers.join(", ")}`);
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
        numChunks: 1
    });
    let collectionRate = 1000 * 10;
    let lastRender = 0;
    let lastCollection = Date.now();
    let lastGrowCheck = 0;
    const growCheckRate = 1000;
    while (true) {
        let now = Date.now();
        memoryManager.checkHomeForRamIncrease();
        if (memMessageWaiting) {
            memMessageWaiting = false;
            memPort.nextWrite().then(_ => { memMessageWaiting = true; });
            readMemRequestsFromPort(ns, memPort, memResponsePort, memoryManager);
        }
        if (lastRender + refreshRate < now) {
            const theme = ns.ui.getTheme();
            ns.clearLog();
            ns.printRaw(React.createElement("div", { style: { display: "flex", gap: "1em" } },
                React.createElement(MemoryDisplay, { manager: memoryManager, theme: theme }),
                React.createElement(LogDisplay, { lines: log, theme: theme })));
            lastRender = now;
        }
        if (lastCollection + collectionRate < now) {
            printLog("INFO: running garbage collection");
            memoryManager.updateReserved();
            memoryManager.cleanupTerminated();
            lastCollection = now;
        }
        if (lastGrowCheck + growCheckRate < now) {
            await growAllocations(ns, memoryManager);
            lastGrowCheck = now;
        }
        await ns.sleep(50);
    }
}
function readMemRequestsFromPort(ns, memPort, memResponsePort, memoryManager) {
    for (const nextMsg of readAllFromPort(ns, memPort)) {
        let msg = nextMsg;
        const requestId = msg[1];
        let payload;
        switch (msg[0]) {
            case MessageType.Worker:
                const hostPayload = msg[2];
                const hosts = Array.isArray(hostPayload) ? hostPayload : [hostPayload];
                for (const h of hosts) {
                    memoryManager.pushWorker(h);
                }
                // Don't send a response, no one is listening.
                continue;
            case MessageType.Request:
                const request = msg[2];
                printLog(`INFO: request pid=${request.pid} filename=${request.filename} ` +
                    `${request.numChunks}x${ns.formatRam(request.chunkSize)} ` +
                    `contiguous=${request.contiguous ?? false} ` +
                    `coreDependent=${request.coreDependent ?? false} ` +
                    `longRunning=${request.longRunning ?? false}`);
                const allocation = memoryManager.allocate(request.pid, request.filename, request.chunkSize, request.numChunks, request.contiguous ?? false, request.coreDependent ?? false, request.shrinkable ?? false, request.longRunning ?? false);
                if (allocation) {
                    printLog(`SUCCESS: allocated id ${allocation.allocationId} ` +
                        `across ${allocation.hosts.length} hosts`);
                }
                else {
                    printLog("WARN: allocation failed, not enough space");
                }
                payload = allocation;
                break;
            case MessageType.GrowableRequest:
                const growReq = msg[2];
                printLog(`INFO: growable request pid=${growReq.pid} filename=${growReq.filename} ` +
                    `${growReq.numChunks}x${ns.formatRam(growReq.chunkSize)}`);
                const growAlloc = memoryManager.allocate(growReq.pid, growReq.filename, growReq.chunkSize, growReq.numChunks, growReq.contiguous ?? false, growReq.coreDependent ?? false, growReq.shrinkable ?? true, growReq.longRunning ?? false, growReq.port);
                if (growAlloc) {
                    printLog(`SUCCESS: allocated id ${growAlloc.allocationId} ` +
                        `across ${growAlloc.hosts.length} hosts`);
                }
                else {
                    printLog("WARN: growable allocation failed");
                }
                payload = growAlloc;
                break;
            case MessageType.Release:
                const release = msg[2];
                if (memoryManager.deallocate(release.allocationId, release.pid, release.hostname)) {
                    printLog(`SUCCESS: released allocation ${release.allocationId} ` +
                        `pid=${release.pid} host=${release.hostname}`);
                }
                else {
                    printLog(`WARN: allocation ${release.allocationId} not found for pid ${release.pid}`);
                }
                // Don't send a response, no one is listening.
                continue;
            case MessageType.ClaimRelease:
                const claimRel = msg[2];
                if (memoryManager.releaseClaim(claimRel.allocationId, claimRel.pid, claimRel.hostname)) {
                    printLog(`SUCCESS: released claim for ${claimRel.allocationId} ` +
                        `pid=${claimRel.pid} host=${claimRel.hostname}`);
                }
                else {
                    printLog(`WARN: claim for allocation ${claimRel.allocationId} not found for pid ${claimRel.pid}`);
                }
                // Don't send a response, no one is listening.
                continue;
            case MessageType.ReleaseChunks:
                const releaseInfo = msg[2];
                printLog(`INFO: release ${releaseInfo.numChunks} chunks from ` +
                    `allocation ${releaseInfo.allocationId}`);
                payload = memoryManager.releaseChunks(releaseInfo.allocationId, releaseInfo.numChunks);
                break;
            case MessageType.Register:
                const reg = msg[2];
                printLog(`INFO: register pid=${reg.pid} host=${reg.hostname} ` +
                    `${reg.numChunks}x${ns.formatRam(reg.chunkSize)} ` +
                    `${reg.filename}`);
                memoryManager.registerAllocation(reg);
                // Don't send a response, no one is listening.
                continue;
            case MessageType.Status:
                payload = { freeRam: memoryManager.getFreeRamTotal() };
                break;
            case MessageType.Snapshot:
                printLog(`INFO: processing snapshot request ${requestId}`);
                payload = memoryManager.getSnapshot();
                break;
            case MessageType.Claim:
                const claimInfo = msg[2];
                if (memoryManager.claimAllocation(claimInfo)) {
                    printLog(`INFO: claimed allocation ${claimInfo.allocationId} ` +
                        `pid=${claimInfo.pid} host=${claimInfo.hostname} ` +
                        `${claimInfo.numChunks}x${ns.formatRam(claimInfo.chunkSize)} ` +
                        `${claimInfo.filename}`);
                }
                else {
                    printLog(`WARN: failed to claim allocation ${claimInfo.allocationId}`);
                }
                // Don't send a response, no one is listening.
                continue;
        }
        // TODO: make this more robust when the response port is full
        memResponsePort.write([requestId, payload]);
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
        printLog(`INFO: growing allocation ${alloc.id} by ${totalChunks}x${chunkSize} from ${host}`);
        const port = ns.getPortHandle(alloc.notifyPort);
        while (!port.tryWrite(newChunks)) {
            await ns.sleep(20);
        }
    }
}
/**
 * Display memory usage for each worker host.
 *
 * @param manager - The allocator to read usage from.
 * @param theme - The UI theme.
 */
function MemoryDisplay({ manager, theme }) {
    const workers = Array.from(manager.workers.values());
    const cellStyle = { padding: "0 0.5em" };
    return (React.createElement("div", { style: { fontFamily: "monospace" } },
        React.createElement("table", null,
            React.createElement("tbody", null, workers.map((w, idx) => React.createElement(MemoryRow, { worker: w, theme: theme, rowIndex: idx, cellStyle: cellStyle }))))));
}
/**
 * Show recent log lines in a styled list.
 *
 * @param lines - Log messages to display.
 * @param theme - The UI theme.
 */
function LogDisplay({ lines, theme }) {
    const rowStyle = (idx) => idx % 2 === 1 ? { backgroundColor: theme.well } : {};
    const lineColor = (line) => {
        if (line.startsWith("ERROR:"))
            return theme.error;
        if (line.startsWith("SUCCESS:"))
            return theme.success;
        if (line.startsWith("WARN:"))
            return theme.warning;
        if (line.startsWith("INFO:"))
            return theme.info;
        return theme.success;
    };
    return (React.createElement("div", { style: { fontFamily: "monospace" } }, lines.map((line, idx) => {
        const style = { ...rowStyle(idx), color: lineColor(line) };
        return React.createElement("div", { key: idx, style: style }, line);
    })));
}
function MemoryRow({ worker, rowIndex, cellStyle, theme }) {
    return (React.createElement("tr", { key: worker.hostname, style: rowIndex % 2 === 1 ? { backgroundColor: theme.well } : undefined },
        React.createElement("td", { style: { ...cellStyle, textAlign: "left" } }, worker.hostname),
        React.createElement("td", { style: { ...cellStyle, textAlign: "right" } }, worker.totalRamStr),
        React.createElement("td", { style: { ...cellStyle, textAlign: "right", minWidth: "215px" } },
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
    let setAsideBar = "|".repeat(setAsideSeg);
    let reservedBar = "|".repeat(reservedSeg);
    let allocBar = "|".repeat(allocSeg);
    let freeBar = "-".repeat(freeSeg);
    return React.createElement(React.Fragment, null,
        React.createElement("span", { key: "s", style: { color: theme.infolight } }, setAsideBar),
        React.createElement("span", { key: "r", style: { color: theme.hp } }, reservedBar),
        React.createElement("span", { key: "a", style: { color: theme.money } }, allocBar),
        React.createElement("span", null, freeBar));
}
function calculateBarSegments(segmentRam, totalRam, segments) {
    if (segmentRam > 1 && totalRam > 0) {
        let numSegments = (segmentRam / totalRam) * segments;
        return numSegments > 0 && numSegments < 1 ? 1 : Math.round(numSegments);
    }
    else {
        return 0;
    }
}
