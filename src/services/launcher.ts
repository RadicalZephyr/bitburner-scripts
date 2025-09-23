import type { AutocompleteData, NS, RunOptions, ScriptArg } from '@ns';
import { FlagsSchema, parseFlags } from 'util/flags';

import { ALLOC_ID_ARG } from 'services/client/memory_tag';

import {
    LAUNCH_PORT,
    LAUNCH_RESPONSE_PORT,
    MessageType,
    LaunchProtocol,
    LaunchRunOptions,
    LaunchProtocolDef,
} from 'services/client/launch';
import { MemoryClient, TransferableAllocation } from 'services/client/memory';

import { collectDependencies } from 'util/dependencies';
import { BaseServer, Handlers } from 'util/protocol';

const FLAGS = [['help', false]] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    if (flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

Provide a script executing service.

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --help   Show this help message
`);
        return;
    }

    await startLaunchService(ns);
}

async function startLaunchService(ns: NS) {
    ns.disableLog('sleep');

    const memClient = new MemoryClient(ns);
    const self = ns.self();
    void memClient.registerAllocation(self.server, self.ramUsage, 1);

    const server = new Server(ns);

    await server.readLoop();
}

class Server extends BaseServer<LaunchProtocolDef> {
    constructor(ns: NS) {
        const requestPort = ns.getPortHandle(LAUNCH_PORT);
        const responsePort = ns.getPortHandle(LAUNCH_RESPONSE_PORT);
        const handlers: Handlers<LaunchProtocolDef> = {
            [MessageType.Launch]: async (payload) => {
                const result = await launch(
                    ns,
                    payload.script,
                    payload.options,
                    ...payload.args,
                );

                if (result == null) {
                    return {
                        ok: false,
                        error: new Error('Failed to launch script'),
                    };
                }

                return {
                    ok: true,
                    allocationId: result.allocation.allocationId,
                    hosts: result.allocation.allocatedChunks.map((c) => ({
                        hostname: c.hostname,
                        chunkSize: c.chunkSize,
                        numChunks: c.numChunks,
                    })),
                    pids: result.pids,
                };
            },
        } as const;
        super(ns, LaunchProtocol, requestPort, responsePort, handlers);
    }
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
    let ramOverride: number | null | undefined;
    let baseRunOpts: RunOptions = {};
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
        baseRunOpts = baseRunOptions(threadOrOptions);
    }

    const allocation = await client.requestTransferableAllocation(
        ramOverride ?? scriptRam,
        totalThreads,
        allocOptions,
    );
    if (!allocation) {
        ns.print(`WARN: failed to launch ${script}, could not allocate memory`);
        return null;
    }

    const dependencies = Array.from(collectDependencies(ns, script));
    const pids: number[] = [];
    for (const allocationChunk of allocation.allocatedChunks) {
        if (totalThreads <= 0) break;

        const threadsHere = Math.min(allocationChunk.numChunks, totalThreads);
        if (isNaN(threadsHere) || threadsHere < 0) continue;

        const hostname = allocationChunk.hostname;
        ns.scp([...dependencies, ...explicitDependencies], hostname, 'home');

        const runOptions = createRunOptions(threadsHere, baseRunOpts);
        const pid = ns.exec(
            script,
            hostname,
            runOptions,
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

function baseRunOptions(opts: LaunchRunOptions): RunOptions {
    return {
        threads: opts.threads === null ? undefined : opts.threads,
        temporary: opts.temporary === null ? undefined : opts.temporary,
        ramOverride: opts.ramOverride === null ? undefined : opts.ramOverride,
        preventDuplicates:
            opts.preventDuplicates === null
                ? undefined
                : opts.preventDuplicates,
    };
}

function createRunOptions(threads: number, options: RunOptions): RunOptions {
    return { ...options, threads };
}
