import type { NetscriptPort, NS, ScriptArg } from '@ns';

import type {
    LaunchRunOptions,
    StrictRunOptions,
} from 'services/client/launch';
import {
    MEMORY_PORT,
    MemoryClient,
    TransferableAllocation,
    MessageType,
    AllocOptions,
    GrowableAllocationRequest,
    AllocationRelease,
    HostAllocation,
    AllocationChunk,
    MemoryProtocol,
    isHostAllocation,
} from 'services/client/memory';
import { ALLOC_ID_ARG } from 'services/client/memory_tag';
import { PortClient } from 'services/client/port';

import { CONFIG } from 'services/config';

import { readAllFromPort } from 'util/ports';
import { collectDependencies } from 'util/dependencies';
import { makeFuid } from 'util/fuid';
import { isArrayOf } from 'util/validate';

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
        if (typeof port !== 'number') {
            this.ns.print('WARN: failed to allocate grow port');
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

        const result = await this.client.sendMessageReceiveResponse(
            MessageType.GrowableRequest,
            payload,
        );
        if (!result) {
            await portClient.releasePort(port);
            this.ns.print('WARN: growable allocation request failed');
            return null;
        }
        const allocation = result;
        return new GrowableAllocation(
            this.ns,
            allocation.allocationId,
            allocation.hosts,
            port,
        );
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

    constructor(
        ns: NS,
        allocationId: number,
        chunks: HostAllocation[],
        port: number,
    ) {
        super(allocationId, chunks);
        this.ns = ns;
        this.portId = port;
        this.port = ns.getPortHandle(port);
    }

    /**
     * Starts a background polling loop to handle grow messages for this allocation.
     *
     * @remarks
     * This function runs continuously until `this.release()` is
     * called. It listens for new grow messages and updates the
     * allocation list accordingly.
     *
     * Use the `shouldMergeChunks` option to control how new chunks are handled:
     *
     * - `true`: Merge new chunks into existing entries for each host. This avoids
     *   duplicates and keeps the list smaller, which is better for load balancing
     *   or scaling tasks across fewer targets.
     *   - ⚠️ Note: This reorders chunks and may change the `numChunks` count, potentially
     *     affecting chunk distribution and ordering-sensitive logic.
     *
     * - `false` (default): Append new chunks as separate entries. This preserves
     *   ordering but may lead to duplication and a larger list.
     *
     * Errors during polling are logged to the script output but do not stop the loop.
     *
     * @param shouldMergeChunks - If true, merges new chunks into existing host entries. If false, appends them as separate entries.
     */
    async startPolling(shouldMergeChunks: boolean = false) {
        while (this.running) {
            const nextWrite = this.port.nextWrite();
            try {
                this.pollGrowth(shouldMergeChunks);
            } catch (err) {
                this.ns.print(
                    `WARN: threw error while polling for allocation grow messages: ${String(err)}`,
                );
            }
            await nextWrite;
        }
    }

    /**
     * Check for new grow messages and update the allocation list accordingly.
     *
     * See documentation for `GrowableAllocation.startPolling` for discussion of the `shouldMergeChunks` argument.
     *
     * @param shouldMergeChunks - If true, merges new chunks into existing host entries. If false, appends them as separate entries.
     */
    pollGrowth(shouldMergeChunks: boolean = false) {
        const isHostAllocArray = isArrayOf(isHostAllocation);
        for (const msg of readAllFromPort(this.port)) {
            if (isHostAllocArray(msg)) {
                if (shouldMergeChunks) {
                    mergeChunks(this.allocatedChunks, msg);
                } else {
                    appendChunks(this.allocatedChunks, msg);
                }
            }
        }
    }

    /** Release this allocation and free the port. */
    release(ns: NS): Promise<void> {
        const proc = ns.self();
        const memPort = ns.getPortHandle(MEMORY_PORT);
        const portClient = new PortClient(ns);
        return this._release(proc, memPort, portClient);
    }

    private async _release(
        proc: {
            pid: number;
            server: string;
        },
        memPort: NetscriptPort,
        portClient: PortClient,
    ): Promise<void> {
        this.running = false;
        const release: AllocationRelease = {
            allocationId: this.allocationId,
            pid: proc.pid,
            hostname: proc.server,
        };

        await MemoryProtocol.sendMessage(memPort, MessageType.Release, release);
        await portClient.releasePort(this.portId);
    }

    /**
     * Release the allocation when the script exits.
     */
    releaseAtExit(ns: NS) {
        const memPort = ns.getPortHandle(MEMORY_PORT);
        const portClient = new PortClient(ns);
        const rel = this._release.bind(
            this,
            ns.self(),
            memPort,
            portClient,
        ) as () => Promise<void>;
        ns.atExit(
            () => {
                void rel();
            },
            'memoryRelease-' + makeFuid(ns),
        );
        ns.print(
            `INFO: registered atExit release for allocation ${this.allocationId}`,
        );
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
    async launch(
        script: string,
        threads: number | LaunchRunOptions,
        ...args: ScriptArg[]
    ): Promise<number[]> {
        let totalThreads: number;
        let explicitDependencies: string[] = [];
        let baseRunOptions: StrictRunOptions | undefined;
        if (typeof threads === 'number') {
            totalThreads = threads;
        } else {
            totalThreads = threads.threads ?? 1;
            explicitDependencies = threads.dependencies ?? [];
            const runOpts: StrictRunOptions = {};
            if (threads.ramOverride !== undefined)
                runOpts.ramOverride = threads.ramOverride;
            if (threads.temporary !== undefined)
                runOpts.temporary = threads.temporary;
            if (threads.preventDuplicates !== undefined)
                runOpts.preventDuplicates = threads.preventDuplicates;
            if (Object.keys(runOpts).length > 0) {
                baseRunOptions = runOpts;
            }
        }

        const dependencies = Array.from(collectDependencies(this.ns, script));
        const pids: number[] = [];
        for (const chunk of this.allocatedChunks) {
            if (totalThreads <= 0) break;

            const threadsHere = Math.min(chunk.numChunks, totalThreads);
            if (isNaN(threadsHere) || threadsHere < 1) continue;

            const hostname = chunk.hostname;
            this.ns.scp(
                [...dependencies, ...explicitDependencies],
                hostname,
                'home',
            );
            const execArgs = [...args, ALLOC_ID_ARG, this.allocationId];

            let retryCount = 0;
            while (true) {
                if (retryCount > CONFIG.launchRetryMax) {
                    this.ns.print(
                        `ERROR: GrowableAllocation.launch repeatedly failed to exec ${script} on ${chunk.hostname}`,
                    );
                    this.ns.ui.openTail();
                    return pids;
                }

                const runOptions = baseRunOptions
                    ? { ...baseRunOptions, threads: threadsHere }
                    : threadsHere;
                const pid = this.ns.exec(
                    script,
                    chunk.hostname,
                    runOptions as never,
                    ...execArgs,
                );
                if (pid === 0) {
                    retryCount += 1;
                    this.ns.printf(
                        `WARN: failed to spawn ${threadsHere} threads of ${script} on ${chunk.hostname} trying again`,
                    );
                    await this.ns.sleep(10);
                } else {
                    pids.push(pid);
                    totalThreads -= threadsHere;
                    break;
                }
            }
        }

        if (totalThreads > 0) {
            this.ns.printf(
                'ERROR: failed to spawn all the requested threads. %s threads remaining',
                totalThreads,
            );
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

/** Merge chunks into an existing list, maximizing the numChunks for each host. */
function mergeChunks(dest: AllocationChunk[], add: HostAllocation[]) {
    for (const chunk of add) {
        const existing = dest.find(
            (c) =>
                c.hostname === chunk.hostname
                && c.chunkSize === chunk.chunkSize,
        );
        if (existing) {
            existing.numChunks += chunk.numChunks;
        } else {
            dest.push(new AllocationChunk(chunk));
        }
    }
}
