import type { NS, NetscriptPort, ScriptArg } from 'netscript';
import { MEM_TAG_FLAGS, ALLOC_ID_ARG } from 'services/client/memory_tag';
import {
    LAUNCH_PORT,
    LAUNCH_RESPONSE_PORT,
    MessageType,
    LaunchRequest,
    LaunchResponse,
    LaunchRunOptions,
} from 'services/client/launch';
import { MemoryClient, TransferableAllocation } from 'services/client/memory';
import { readAllFromPort, readLoop } from 'util/ports';
import { collectDependencies } from 'util/dependencies';

export async function main(ns: NS) {
    ns.flags(MEM_TAG_FLAGS);
    ns.disableLog('sleep');

    const memClient = new MemoryClient(ns);
    const self = ns.self();
    memClient.registerAllocation(self.server, self.ramUsage, 1);

    const port = ns.getPortHandle(LAUNCH_PORT);
    const respPort = ns.getPortHandle(LAUNCH_RESPONSE_PORT);

    await readLoop(ns, port, () => readRequests(ns, port, respPort));
}

async function readRequests(ns: NS, port: NetscriptPort, resp: NetscriptPort) {
    for (const next of readAllFromPort(ns, port)) {
        const msg = next as [MessageType, string, LaunchRequest];
        const requestId = msg[1];
        if (msg[0] !== MessageType.Launch) continue;
        const payload = msg[2];
        if (!isValidRequest(payload)) {
            ns.print('ERROR: invalid launch request');
            resp.write([requestId, null]);
            continue;
        }
        const result = await launch(
            ns,
            payload.script,
            payload.options,
            ...payload.args,
        );
        const response: LaunchResponse | null = result
            ? {
                  allocationId: result.allocation.allocationId,
                  hosts: result.allocation.allocatedChunks.map((c) => ({
                      hostname: c.hostname,
                      chunkSize: c.chunkSize,
                      numChunks: c.numChunks,
                  })),
                  pids: result.pids,
              }
            : null;
        while (!resp.tryWrite([requestId, response])) {
            await ns.sleep(20);
        }
    }
}

function isValidRequest(req: LaunchRequest): boolean {
    return (
        req
        && typeof req.script === 'string'
        && typeof req.options === 'object'
        && Array.isArray(req.args)
    );
}

/**
 * Launch a script on a host with enough free memory.
 *
 * This requests an allocation for the script from the memory manager
 * and spawns the script on each allocated host.
 *
 * Set `ramOverride` in {@link LaunchRunOptions} to adjust the RAM
 * passed to {@link NS.exec} for each thread.
 */
export async function launch(
    ns: NS,
    script: string,
    threadOrOptions?: number | LaunchRunOptions,
    ...args: ScriptArg[]
): Promise<{ allocation: TransferableAllocation; pids: number[] } | null> {
    const scriptRam = ns.getScriptRam(script, 'home');
    const client = new MemoryClient(ns);

    let totalThreads: number;
    let contiguous = false;
    let coreDependent = false;
    let longRunning = false;
    let explicitDependencies: string[] = [];
    let ramOverride: number | undefined;
    if (
        typeof threadOrOptions === 'number'
        || typeof threadOrOptions === 'undefined'
    ) {
        totalThreads =
            typeof threadOrOptions === 'number' ? threadOrOptions : 1;
    } else {
        totalThreads = threadOrOptions.threads ?? 1;
        contiguous = threadOrOptions.contiguous ?? false;
        coreDependent = threadOrOptions.coreDependent ?? false;
        longRunning = threadOrOptions.longRunning ?? false;
        explicitDependencies = threadOrOptions.dependencies ?? [];
        ramOverride = threadOrOptions.ramOverride;
    }

    const allocation = await client.requestTransferableAllocation(
        ramOverride ?? scriptRam,
        totalThreads,
        {
            contiguous,
            coreDependent,
            longRunning,
        },
    );
    if (!allocation) {
        ns.print(`WARN: failed to launch ${script}, could not allocate memory`);
        return null;
    }

    const dependencies = Array.from(collectDependencies(ns, script));
    const pids: number[] = [];
    for (const allocationChunk of allocation.allocatedChunks) {
        const hostname = allocationChunk.hostname;
        const threadsHere = allocationChunk.numChunks;
        if (isNaN(threadsHere)) continue;
        ns.scp([...dependencies, ...explicitDependencies], hostname, 'home');
        const runOptions =
            ramOverride !== undefined
                ? { threads: threadsHere, ramOverride }
                : threadsHere;
        const pid = ns.exec(
            script,
            hostname,
            runOptions as never,
            ...args,
            ALLOC_ID_ARG,
            allocation.allocationId,
        );
        if (!pid) {
            ns.tprintf(
                'failed to spawn %d threads of %s on %s',
                threadsHere,
                script,
                hostname,
            );
        } else {
            pids.push(pid);
            totalThreads -= threadsHere;
        }
    }
    if (totalThreads > 0) {
        ns.tprintf(
            'failed to spawn all the requested threads. %s threads remaining',
            totalThreads,
        );
    }
    return { allocation, pids };
}
