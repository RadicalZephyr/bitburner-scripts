import type { AutocompleteData, NS } from "netscript";

import { ManagerClient, Lifecycle } from "batch/client/task_selector";

import { registerAllocationOwnership, MemoryClient } from "services/client/memory";


export function autocomplete(data: AutocompleteData, _args: string[]): string[] {
    return data.servers;
}

export async function main(ns: NS) {
    ns.disableLog('ALL');

    const flags = ns.flags([
        ['allocation-id', -1],
        ['max-threads', -1],
        ['help', false],
    ]);

    const rest = flags._ as string[];
    if (rest.length === 0 || flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()} SERVER_NAME

Launch as many weaken threads as needed to minimize security of SERVER_NAME.

Example:
  > run ${ns.getScriptName()} n00dles

OPTIONS
  --help           Show this help message
  --max-threads    Cap the number of threads spawned
`);
        return;
    }

    let allocationId = flags['allocation-id'];
    if (allocationId !== -1) {
        if (typeof allocationId !== 'number') {
            ns.tprint('--allocation-id must be a number');
            return;
        }
        await registerAllocationOwnership(ns, allocationId, "self");
    }

    let maxThreads = flags['max-threads'];
    if (maxThreads !== -1) {
        if (typeof maxThreads !== 'number' || maxThreads <= 0) {
            ns.tprint('--max-threads must be a positive number');
            ns.ui.openTail();
            return;
        }
    }

    let target = rest[0];
    if (typeof target !== 'string' || !ns.serverExists(target)) {
        ns.tprintf("target %s does not exist", target);
        return;
    }

    const managerClient = new ManagerClient(ns);
    const memClient = new MemoryClient(ns);
    const script = "/batch/w.js";
    const scriptRam = ns.getScriptRam(script, "home");

    let maxThreadsCap = calculateWeakenThreads(ns, target);
    if (maxThreads !== -1) {
        maxThreadsCap = Math.min(maxThreadsCap, maxThreads);
    }

    if (maxThreadsCap === 0 || isNaN(maxThreadsCap)) {
        ns.printf("%s security is already at minimum level", target);
        ns.toast(`finished tilling ${target}!`, "success");
        managerClient.finishedTilling(target);
        return;
    }

    let requestThreads = maxThreadsCap;
    let allocation = await memClient.requestTransferableAllocation(
        scriptRam,
        requestThreads,
        false,
        true,
    );
    while (!allocation && requestThreads > 1) {
        requestThreads = Math.floor(requestThreads / 2);
        await ns.sleep(1000);
        allocation = await memClient.requestTransferableAllocation(
            scriptRam,
            requestThreads,
            false,
            true,
        );
    }
    if (!allocation) {
        ns.tprint("ERROR: failed to allocate memory for weaken threads");
        return;
    }

    // Send a Till Heartbeat to indicate we're starting the main loop
    await managerClient.heartbeat(ns.pid, ns.getScriptName(), target, Lifecycle.Till);

    let threadsNeeded = calculateWeakenThreads(ns, target);
    const totalThreads = allocation.allocatedChunks.reduce((s, c) => s + c.numChunks, 0);

    let round = 0;

    while (threadsNeeded > 0) {
        round += 1;
        const roundsRemaining = Math.ceil(threadsNeeded / totalThreads);
        const totalRounds = (round - 1) + roundsRemaining;

        const roundTime = ns.getWeakenTime(target);
        const roundStart = ns.self().onlineRunningTime * 1000;
        const roundEnd = roundStart + roundTime;
        const totalExpectedEnd = roundStart + (roundsRemaining * roundTime);

        const spawnThreads = Math.min(threadsNeeded, totalThreads);
        const pids: number[] = [];
        let remaining = spawnThreads;

        for (const chunk of allocation.allocatedChunks) {
            if (remaining <= 0) break;
            const t = Math.min(chunk.numChunks, remaining);
            ns.scp(script, chunk.hostname, "home");
            const pid = ns.exec(script, chunk.hostname, t, target, 0);
            if (pid) {
                pids.push(pid);
            } else {
                ns.tprintf("failed to spawn %d threads on %s", t, chunk.hostname);
            }
            remaining -= t;
        }

        for (const pid of pids) {
            while (ns.isRunning(pid)) {
                ns.clearLog();
                const elapsed = ns.self().onlineRunningTime * 1000;
                ns.print(`
Round ${round} of ${totalRounds}
Round ends:         ${ns.tFormat(roundEnd)}
Total expected:     ${ns.tFormat(totalExpectedEnd)}
Elapsed time:       ${ns.tFormat(elapsed)}
`);
                await managerClient.heartbeat(ns.pid, ns.getScriptName(), target, Lifecycle.Till);
                await ns.sleep(1000);
            }
        }

        threadsNeeded = calculateWeakenThreads(ns, target);
    }

    await allocation.release(ns);
    ns.toast(`finished tilling ${target}!`, "success");
    managerClient.finishedTilling(target);
}

/** Calculate the number of weaken threads required to bring
 *  `target` back to its minimum security level.
 */
export function calculateWeakenThreads(ns: NS, target: string): number {
    let minSec = ns.getServerMinSecurityLevel(target);
    let curSec = ns.getServerSecurityLevel(target);
    let deltaSec = curSec - minSec;

    if (deltaSec <= 0 || isNaN(deltaSec)) return 0;

    return Math.ceil(deltaSec * 20);
}
