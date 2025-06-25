import type { AutocompleteData, NS, RunOptions, ScriptArg } from "netscript";

export interface LaunchRunOptions extends RunOptions {
    allocationFlag?: string;
}

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
 */
export async function launch(ns: NS, script: string, threadOrOptions?: number | LaunchRunOptions, ...args: ScriptArg[]) {
    let scriptRam = ns.getScriptRam(script);
    let client = new MemoryClient(ns);

    let totalThreads: number;
    let allocationFlag: string | undefined;
    if (typeof threadOrOptions === 'number' || typeof threadOrOptions === 'undefined') {
        totalThreads = typeof threadOrOptions === 'number' ? threadOrOptions : 1;
        allocationFlag = undefined;
    } else {
        totalThreads = threadOrOptions.threads ?? 1;
        allocationFlag = threadOrOptions.allocationFlag;
    }

    let allocation = await client.requestTransferableAllocation(scriptRam, totalThreads);

    let dependencies = Array.from(collectDependencies(ns, script));
    let pids = [];
    for (const allocationChunk of allocation.allocatedChunks) {
        let hostname = allocationChunk.hostname;
        let threadsHere = allocationChunk.numChunks;

        if (isNaN(threadsHere)) continue;

        ns.scp(dependencies, hostname);
        let execArgs = allocationFlag ? [allocationFlag, allocation.allocationId, ...args] : args;
        let pid = ns.exec(script, hostname, threadsHere, ...execArgs);
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

function collectDependencies(ns: NS, file: string, visited = new Set<string>()): Set<string> {
    if (visited.has(file)) return visited;
    visited.add(file);
    const content = ns.read(file);
    if (typeof content === "string" && content.length > 0) {
        const regex = /^\s*import[^\n]*? from ["'](.+?)["']/gm;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(content)) !== null) {
            const dep = resolveImport(file, match[1]);
            collectDependencies(ns, dep, visited);
        }
    }
    return visited;
}

function resolveImport(base: string, importPath: string): string {
    if (!importPath.endsWith(".js")) {
        importPath += ".js";
    }
    if (importPath.startsWith("./")) {
        const idx = base.lastIndexOf("/");
        const dir = idx >= 0 ? base.slice(0, idx + 1) : "";
        return dir + importPath.slice(2);
    } else if (importPath.startsWith("/")) {
        importPath = importPath.slice(1);
    }
    return importPath;
}
