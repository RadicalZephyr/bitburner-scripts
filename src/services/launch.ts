import type { AutocompleteData, NS, RunOptions, ScriptArg } from "netscript";
import { ALLOC_ID_ARG, MEM_TAG_FLAGS } from "services/client/memory_tag";

export interface LaunchRunOptions extends RunOptions {
    coreDependent?: boolean;
    longRunning?: boolean;
    dependencies?: string[];
}

import { MemoryClient } from "services/client/memory";

import { collectDependencies } from "util/dependencies";

export function autocomplete(data: AutocompleteData, args: string[]): string[] {
    return data.scripts;
}

export async function main(ns: NS) {
    const flags = ns.flags([
        ['threads', 1],
        ['itail', null],
        ['ram_override', null],
        ['core-dependent', false],
        ['long-running', false],
        ['help', false],
        ...MEM_TAG_FLAGS
    ]);

    const rest = flags._ as ScriptArg[];

    if (rest.length === 0 || flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()} SCRIPT_NAME [--threads num_threads] [--ram_override ram_in_GBs] [--allocation-flag FLAG] [--core-dependent] [--long-running] [args...]

Run the script at SCRIPT_NAME, getting an allocation for it from the memory
manager and spawning the script on the returned host. Otherwise, this script
functions exactly like the 'run' command.

OPTIONS
  --help             Show this help message
  --threads          Number of threads to run
  --ram_override     Override static RAM calculation
  --core-dependent   Prefer allocations from home when available
  --long-running     Prefer non-home servers when allocating
`);
        return;
    }
    let script = rest.shift();
    if (typeof script !== 'string' || !ns.fileExists(script)) {
        ns.tprint('script must be an existing script');
        return;
    }

    let threads = flags.threads;
    if (typeof threads !== 'number') {
        ns.tprint('--threads must be a number');
        return;
    }

    let ram_override = flags.ram_override;
    if (ram_override !== null && typeof ram_override !== 'number') {
        ns.tprint('--ram_override must be a number');
        return;
    }

    let coreDependent = flags['core-dependent'];
    if (typeof coreDependent !== 'boolean') {
        ns.tprint('--core-dependent must be a boolean');
        return;
    }

    let longRunning = flags['long-running'];
    if (typeof longRunning !== 'boolean') {
        ns.tprint('--long-running must be a boolean');
        return;
    }

    let args = rest;
    let options: LaunchRunOptions = {
        threads: threads,
        ramOverride: ram_override as number,
        coreDependent: coreDependent,
        longRunning: longRunning,
    };

    ns.tprint(`${script} ${JSON.stringify(options)} ${JSON.stringify(args)}`);

    let result = await launch(ns, script, options, ...args);

    result.allocation.releaseAtExit(ns);

    for (const pid of result.pids) {
        while (ns.isRunning(pid)) {
            await ns.sleep(1000);
        }
    }
}

/** Launch a script on a host with enough free memory.
 *
 * This requests a singular allocation for the script from the memory
 * manager and then runs it on the host that was allocated.
 * The `longRunning` option signals that the allocation should avoid
 * the home server when possible.
 */
export async function launch(ns: NS, script: string, threadOrOptions?: number | LaunchRunOptions, ...args: ScriptArg[]) {
    let scriptRam = ns.getScriptRam(script, "home");
    let client = new MemoryClient(ns);

    let totalThreads: number;
    let coreDependent = false;
    let longRunning = false;
    let explicitDependencies = [];
    if (typeof threadOrOptions === 'number' || typeof threadOrOptions === 'undefined') {
        totalThreads = typeof threadOrOptions === 'number' ? threadOrOptions : 1;
    } else {
        totalThreads = threadOrOptions.threads ?? 1;
        coreDependent = threadOrOptions.coreDependent ?? false;
        longRunning = threadOrOptions.longRunning ?? false;
        explicitDependencies = threadOrOptions.dependencies ?? [];
    }

    let allocation = await client.requestTransferableAllocation(
        scriptRam,
        totalThreads,
        {
            contiguous: false,
            coreDependent,
            longRunning,
        }
    );
    if (!allocation) {
        ns.print(`WARN: failed to launch ${script}, could not allocate memory`);
        return null;
    }

    let dependencies = Array.from(collectDependencies(ns, script));
    let pids = [];
    for (const allocationChunk of allocation.allocatedChunks) {
        let hostname = allocationChunk.hostname;
        let threadsHere = allocationChunk.numChunks;

        if (isNaN(threadsHere)) continue;

        ns.scp([...dependencies, ...explicitDependencies], hostname, "home");
        let pid = ns.exec(script, hostname, threadsHere, ...args, ALLOC_ID_ARG, allocation.allocationId);
        if (!pid) {
            ns.tprintf("failed to spawn %d threads of %s on %s", threadsHere, script, hostname);
        } else {
            pids.push(pid);
            totalThreads -= threadsHere;
        }
    }

    if (totalThreads > 0) {
        ns.tprintf("failed to spawn all the requested threads. %s threads remaining", totalThreads);
    }
    return { allocation: allocation, pids: pids };
}
