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
import {
    MemoryClient,
    TransferableAllocation,
    AllocOptions,
} from 'services/client/memory';
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

async function allocateMemory(
    ns: NS,
    client: MemoryClient,
    script: string,
    ram: number,
    threads: number,
    options: AllocOptions,
): Promise<TransferableAllocation | null> {
    const allocation = await client.requestTransferableAllocation(
        ram,
        threads,
        options,
    );
    if (!allocation) {
        ns.print(`WARN: failed to launch ${script}, could not allocate memory`);
    }
    return allocation;
}

function transferFiles(ns: NS, host: string, files: string[]): void {
    ns.scp(files, host, 'home');
}

function execScript(
    ns: NS,
    script: string,
    host: string,
    threads: number,
    ramOverride: number | undefined,
    allocationId: number,
    args: ScriptArg[],
): number {
    const runOptions =
        ramOverride !== undefined ? { threads, ramOverride } : threads;
    return ns.exec(
        script,
        host,
        runOptions as never,
        ...args,
        ALLOC_ID_ARG,
        allocationId,
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
async function launch(
    ns: NS,
    script: string,
    threadOrOptions?: number | LaunchRunOptions,
    ...args: ScriptArg[]
): Promise<{ allocation: TransferableAllocation; pids: number[] } | null> {
    const scriptRam = ns.getScriptRam(script, 'home');
    const client = new MemoryClient(ns);

    let allocOptions = {};
    let totalThreads: number;
    let explicitDependencies: string[] = [];
    let ramOverride: number | undefined;
    if (
        typeof threadOrOptions === 'number'
        || typeof threadOrOptions === 'undefined'
    ) {
        totalThreads =
            typeof threadOrOptions === 'number' ? threadOrOptions : 1;
    } else {
        allocOptions = threadOrOptions.alloc ?? {};
        totalThreads = threadOrOptions.threads ?? 1;
        explicitDependencies = threadOrOptions.dependencies ?? [];
        ramOverride = threadOrOptions.ramOverride;
    }

    const allocation = await allocateMemory(
        ns,
        client,
        script,
        ramOverride ?? scriptRam,
        totalThreads,
        allocOptions,
    );
    if (!allocation) {
        return null;
    }

    const dependencies = Array.from(collectDependencies(ns, script));
    const pids: number[] = [];
    for (const allocationChunk of allocation.allocatedChunks) {
        if (totalThreads <= 0) break;

        const threadsHere = Math.min(allocationChunk.numChunks, totalThreads);
        if (isNaN(threadsHere) || threadsHere < 0) continue;

        const hostname = allocationChunk.hostname;
        transferFiles(ns, hostname, [...dependencies, ...explicitDependencies]);

        const pid = execScript(
            ns,
            script,
            hostname,
            threadsHere,
            ramOverride,
            allocation.allocationId,
            args,
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
