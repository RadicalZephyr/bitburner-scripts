import type { NetscriptPort, NS, ScriptArg, RunOptions } from "netscript";

import type { LaunchRunOptions } from "services/launch";
import {
    MEMORY_PORT,
    MemoryClient,
    TransferableAllocation,
    MessageType,
    AllocOptions,
    GrowableAllocationRequest,
    AllocationRelease,
    AllocationResult,
    HostAllocation,
    AllocationChunk,
} from "services/client/memory";
import { PortClient } from "services/client/port";

import { CONFIG } from "services/config";

import { sendMessage } from "util/client";
import { readAllFromPort } from "util/ports";
import { collectDependencies } from "util/dependencies";


/** Client helper for growable allocations. */
export class GrowableMemoryClient extends MemoryClient {
    /**
     * Request a growable allocation of RAM.
     *
     * @param chunkSize - Size of each chunk in GB
     * @param numChunks - Desired number of chunks
     * @param options   - Flags that modify allocation strategy
     * @returns Growable allocation info or null on failure
     */
    async requestGrowableAllocation(
        chunkSize: number,
        numChunks: number,
        options?: AllocOptions,
    ): Promise<GrowableAllocation | null> {
        const portClient = new PortClient(this.ns);
        const port = await portClient.requestPort();
        if (typeof port !== "number") {
            this.ns.print("WARN: failed to allocate grow port");
            return null;
        }

        const contiguous = options?.contiguous ?? false;
        const coreDependent = options?.coreDependent ?? false;
        const shrinkable = options?.shrinkable ?? true;
        const longRunning = options?.longRunning ?? false;

        const payload: GrowableAllocationRequest = {
            pid: this.ns.pid,
            filename: this.ns.self().filename,
            chunkSize,
            numChunks,
            contiguous,
            coreDependent,
            shrinkable,
            longRunning,
            port,
        };

        const result = await this.sendMessageReceiveResponse(
            MessageType.GrowableRequest,
            payload,
        );
        if (!result) {
            await portClient.releasePort(port);
            this.ns.print("WARN: growable allocation request failed");
            return null;
        }
        const allocation = result as AllocationResult;
        return new GrowableAllocation(this.ns, allocation.allocationId, allocation.hosts, port);
    }
}

/**
 * Allocation that can receive additional memory chunks.
 */
export class GrowableAllocation extends TransferableAllocation {
    private ns: NS;
    private portId: number;
    private port: NetscriptPort;
    private running = true;

    constructor(ns: NS, allocationId: number, chunks: HostAllocation[], port: number) {
        super(allocationId, chunks);
        this.ns = ns;
        this.portId = port;
        this.port = ns.getPortHandle(port);
        this.startPolling();
    }

    private async startPolling() {
        while (this.running) {
            const nextWrite = this.port.nextWrite();
            for (const msg of readAllFromPort(this.ns, this.port)) {
                const chunks = msg as HostAllocation[];
                if (Array.isArray(chunks)) {
                    appendChunks(this.allocatedChunks, chunks);
                }
            }
            await nextWrite;
        }
    }

    /** Explicitly poll for growth messages. */
    pollGrowth() {
        for (const msg of readAllFromPort(this.ns, this.port)) {
            const chunks = msg as HostAllocation[];
            if (Array.isArray(chunks)) {
                appendChunks(this.allocatedChunks, chunks);
            }
        }
    }

    /** Release this allocation and free the port. */
    async release(ns: NS): Promise<void> {
        this.running = false;
        const proc = ns.self();
        const release: AllocationRelease = {
            allocationId: this.allocationId,
            pid: proc.pid,
            hostname: proc.server,
        };
        const memPort = ns.getPortHandle(MEMORY_PORT);
        sendMessage(ns, memPort, MessageType.Release, release);
        const portClient = new PortClient(ns);
        await portClient.releasePort(this.portId);
    }

    /**
     * Release the allocation when the script exits.
     */
    releaseAtExit(ns: NS, name?: string) {
        const rel = this.release.bind(this, ns);
        ns.atExit(() => { rel(); }, "memoryRelease" + (name ?? ""));
        ns.print(`INFO: registered atExit release for allocation ${this.allocationId}`);
    }

    /**
     * Launch a script across all allocated chunks.
     *
     * Each chunk is attempted sequentially and a short delay is inserted
     * whenever `ns.exec` fails. The call will retry until the number of
     * failures exceeds `CONFIG.launchRetryMax` at which point the method
     * prints an error, opens the tail window and returns any pids that were
     * successfully spawned.
     *
     * @param script  - Script filename to run.
     * @param threads - Number of threads or launch options.
     * @param args    - Arguments passed to the script.
     * @returns Array of spawned pids.
     */
    async launch(script: string, threads: number | LaunchRunOptions, ...args: ScriptArg[]): Promise<number[]> {
        let totalThreads: number;
        let allocationFlag: string | undefined;
        let explicitDependencies: string[] = [];
        let baseRunOptions: RunOptions | undefined;
        if (typeof threads === "number") {
            totalThreads = threads;
        } else {
            totalThreads = threads.threads ?? 1;
            allocationFlag = threads.allocationFlag;
            explicitDependencies = threads.dependencies ?? [];
            const runOpts: RunOptions = {};
            if (threads.ramOverride !== undefined) runOpts.ramOverride = threads.ramOverride;
            if (threads.temporary !== undefined) runOpts.temporary = threads.temporary;
            if (threads.preventDuplicates !== undefined) runOpts.preventDuplicates = threads.preventDuplicates;
            if (Object.keys(runOpts).length > 0) {
                baseRunOptions = runOpts;
            }
        }

        const dependencies = Array.from(collectDependencies(this.ns, script));
        const pids: number[] = [];
        for (const chunk of this.allocatedChunks) {
            if (totalThreads <= 0) break;
            const threadsHere = Math.min(chunk.numChunks, totalThreads);
            if (threadsHere <= 0) continue;

            this.ns.scp([...dependencies, ...explicitDependencies], chunk.hostname, "home");
            const execArgs = allocationFlag ? [allocationFlag, this.allocationId, ...args] : args;

            let retryCount = 0;
            while (true) {
                if (retryCount > CONFIG.launchRetryMax) {
                    this.ns.print(`ERROR: GrowableAllocation.launch repeatedly failed to exec ${script} on ${chunk.hostname}`);
                    this.ns.ui.openTail();
                    return pids;
                }

                const runOptions = baseRunOptions
                    ? { ...baseRunOptions, threads: threadsHere }
                    : threadsHere;
                const pid = this.ns.exec(script, chunk.hostname, runOptions as never, ...execArgs);
                if (pid === 0) {
                    retryCount += 1;
                    this.ns.printf(`WARN: failed to spawn ${threadsHere} threads of ${script} on ${chunk.hostname} trying again`);
                    await this.ns.sleep(10);
                } else {
                    pids.push(pid);
                    totalThreads -= threadsHere;
                    break;
                }
            }
        }

        if (totalThreads > 0) {
            this.ns.printf("ERROR: failed to spawn all the requested threads. %s threads remaining", totalThreads);
        }
        return pids;
    }
}

/** Append allocation chunks to an existing list without merging. */
function appendChunks(dest: AllocationChunk[], add: HostAllocation[]) {
    for (const chunk of add) {
        dest.push(new AllocationChunk(chunk));
    }
}
