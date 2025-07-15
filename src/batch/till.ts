import type { AutocompleteData, NS } from "netscript";

import { TaskSelectorClient, Lifecycle } from "batch/client/task_selector";

import { GrowableMemoryClient } from "services/client/growable_memory";
import { registerAllocationOwnership } from "services/client/memory";

import { CONFIG } from "batch/config";
import { awaitRound, calculateRoundInfo, RoundInfo } from "batch/progress";
import { TAG_ARG } from "/services/client/memory_tag";

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

    const taskSelectorClient = new TaskSelectorClient(ns);
    const memClient = new GrowableMemoryClient(ns);
    const script = "/batch/w.js";
    const scriptRam = ns.getScriptRam(script, "home");

    let maxThreadsCap = calculateWeakenThreads(ns, target);
    if (maxThreads !== -1) {
        maxThreadsCap = Math.min(maxThreadsCap, maxThreads);
    }

    if (maxThreadsCap === 0 || isNaN(maxThreadsCap)) {
        ns.printf("%s security is already at minimum level", target);
        ns.toast(`finished tilling ${target}!`, "success");
        taskSelectorClient.finishedTilling(target);
        return;
    }

    let requestThreads = maxThreadsCap;
    let allocation = await memClient.requestGrowableAllocation(
        scriptRam,
        requestThreads,
        {
            coreDependent: true,
            shrinkable: true,
        }
    );

    if (!allocation) {
        ns.tprint("ERROR: failed to allocate memory for weaken threads");
        return;
    }

    // Send a Till Heartbeat to indicate we're starting the main loop
    taskSelectorClient.tryHeartbeat(ns.pid, ns.getScriptName(), target, Lifecycle.Till);

    let threadsNeeded = calculateWeakenThreads(ns, target);
    const totalThreads = allocation.numChunks;

    let round = 0;
    let nextHeartbeat = Date.now() + CONFIG.heartbeatCadence + Math.random() * 500;

    while (threadsNeeded > 0) {
        round += 1;
        const roundsRemaining = Math.ceil(threadsNeeded / totalThreads);
        const totalRounds = (round - 1) + roundsRemaining;

        const info: RoundInfo = calculateRoundInfo(ns, target, round, totalRounds, roundsRemaining);

        const spawnThreads = Math.min(threadsNeeded, totalThreads);

        const pids: number[] = await allocation.launch(
            script,
            { threads: spawnThreads, temporary: true },
            target,
            0,
            TAG_ARG,
            allocation.allocationId
        );

        const sendHb = () =>
            Promise.resolve(
                taskSelectorClient.tryHeartbeat(
                    ns.pid,
                    ns.getScriptName(),
                    target,
                    Lifecycle.Till,
                ),
            );
        nextHeartbeat = await awaitRound(ns, pids, info, nextHeartbeat, sendHb);

        threadsNeeded = calculateWeakenThreads(ns, target);
    }

    await allocation.release(ns);
    ns.toast(`finished tilling ${target}!`, "success");
    taskSelectorClient.finishedTilling(target);
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
