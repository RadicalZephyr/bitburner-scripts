import type { AutocompleteData, NS, RunOptions, ScriptArg } from "netscript";

import { MemoryClient } from "./client/memory";

export function autocomplete(data: AutocompleteData, args: string[]): string[] {
    return data.scripts;
}

export async function main(ns: NS) {
    const flags = ns.flags([
        ['threads', 1],
        ['itail', null],
        ['ram_override', null],
        ['help', false],
    ]);

    const rest = flags._ as ScriptArg[];

    if (rest.length === 0 || flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()} SCRIPT_NAME [--threads num_threads] [--ram_override ram_in_GBs] [args...]

Run the script at SCRIPT_NAME, getting an allocation for it from the memory
manager and spawning the script on the returned host. Otherwise, this script
functions exactly like the 'run' command.

OPTIONS
  --help          Show this help message
  --threads       Number of threads to run
  --ram_override  Override static RAM calculation
`);
        return;
    }
    let script = rest.shift();
    if (typeof script !== 'string') {
        ns.tprint('script must be a string');
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

    let args = rest;
    let options = {
        threads: threads,
        ramOverride: ram_override as number
    };

    ns.tprint(`${script} ${JSON.stringify(options)} ${JSON.stringify(args)}`);
    await launch(ns, script, options, ...args);
}

/** Launch a script on a host with enough free memory.
 *
 * This requests a singular allocation for the script from the memory
 * manager and then runs it on the host that was allocated.
 */
export async function launch(ns: NS, script: string, threadOrOptions?: number | RunOptions, ...args: ScriptArg[]) {
    let scriptRam = ns.getScriptRam(script);
    let client = new MemoryClient(ns);

    let totalThreads = typeof threadOrOptions === 'number' ? threadOrOptions : threadOrOptions.threads;

    let allocation = await client.requestTransferableAllocation(scriptRam, totalThreads);

    let pids = [];
    for (const allocationChunk of allocation.allocatedChunks) {
        let hostname = allocationChunk.hostname;
        let threadsHere = allocationChunk.numChunks;

        ns.scp(script, hostname);
        let pid = ns.exec(script, hostname, threadsHere, ...args);
        if (!pid) {
            ns.tprint("failed to spawn %d threads of %s on %s", threadsHere, script, hostname);
        } else {
            pids.push(pid);
            totalThreads -= threadsHere;
        }
    }

    if (totalThreads > 0) {
        ns.tprintf("failed to spawn all the requested threads. %s threads remaining", totalThreads);
    }
    return pids;
}
