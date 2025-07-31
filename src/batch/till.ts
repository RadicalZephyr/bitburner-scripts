import type { AutocompleteData, NS } from 'netscript';
import {
    ALLOC_ID,
    ALLOC_ID_ARG,
    MEM_TAG_FLAGS,
} from 'services/client/memory_tag';
import { FlagsSchema } from 'util/flags';

import { TaskSelectorClient, Lifecycle } from 'batch/client/task_selector';

import { GrowableMemoryClient } from 'services/client/growable_memory';
import { parseAndRegisterAlloc } from 'services/client/memory';

import { CONFIG } from 'batch/config';
import { awaitRound, calculateRoundInfo, RoundInfo } from 'batch/progress';

const FLAGS = [
    ['max-threads', -1],
    ['help', false],
] satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return data.servers;
}

export async function main(ns: NS) {
    ns.disableLog('ALL');

    const flags = ns.flags([...FLAGS, ...MEM_TAG_FLAGS]);

    const rest = flags._ as string[];
    if (
        rest.length === 0
        || typeof flags.help !== 'boolean'
        || flags.help
    ) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()} SERVER_NAME

Launch as many weaken threads as needed to minimize security of SERVER_NAME.

Example:
  > run ${ns.getScriptName()} n00dles

OPTIONS
  --help         Show this help message
  --max-threads  Cap the number of threads spawned

CONFIGURATION
  BATCH_heartbeatCadence  Interval between heartbeat updates
`);
        return;
    }

    const allocationId = await parseAndRegisterAlloc(ns, flags);
    if (flags[ALLOC_ID] !== -1 && allocationId === null) {
        return;
    }

    const maxThreads = flags['max-threads'];
    if (maxThreads !== -1) {
        if (typeof maxThreads !== 'number' || maxThreads <= 0) {
            ns.tprint('--max-threads must be a positive number');
            ns.ui.openTail();
            return;
        }
    }

    const target = rest[0];
    if (typeof target !== 'string' || !ns.serverExists(target)) {
        ns.tprintf('target %s does not exist', target);
        return;
    }

    const taskSelectorClient = new TaskSelectorClient(ns);
    const memClient = new GrowableMemoryClient(ns);
    const script = '/batch/w.js';
    const scriptRam = ns.getScriptRam(script, 'home');

    let maxThreadsCap = calculateWeakenThreads(ns, target);
    if (maxThreads !== -1) {
        maxThreadsCap = Math.min(maxThreadsCap, maxThreads);
    }

    if (maxThreadsCap === 0 || isNaN(maxThreadsCap)) {
        ns.printf('%s security is already at minimum level', target);
        ns.toast(`finished tilling ${target}!`, 'success');
        taskSelectorClient.finishedTilling(target);
        return;
    }

    const requestThreads = maxThreadsCap;
    const allocation = await memClient.requestGrowableAllocation(
        scriptRam,
        requestThreads,
        {
            coreDependent: true,
            shrinkable: true,
        },
    );

    if (!allocation) {
        ns.tprint('ERROR: failed to allocate memory for weaken threads');
        return;
    }

    // Send a Till Heartbeat to indicate we're starting the main loop
    taskSelectorClient.tryHeartbeat(
        ns.pid,
        ns.getScriptName(),
        target,
        Lifecycle.Till,
    );

    let threadsNeeded = calculateWeakenThreads(ns, target);
    const totalThreads = allocation.numChunks;

    let round = 0;
    let nextHeartbeat =
        Date.now() + CONFIG.heartbeatCadence + Math.random() * 500;

    while (threadsNeeded > 0) {
        round += 1;
        const roundsRemaining = Math.ceil(threadsNeeded / totalThreads);
        const totalRounds = round - 1 + roundsRemaining;

        const info: RoundInfo = calculateRoundInfo(
            ns,
            target,
            round,
            totalRounds,
            roundsRemaining,
        );

        const spawnThreads = Math.min(threadsNeeded, totalThreads);

        const pids: number[] = await allocation.launch(
            script,
            { threads: spawnThreads, temporary: true },
            target,
            0,
            ALLOC_ID_ARG,
            allocation.allocationId,
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
    ns.toast(`finished tilling ${target}!`, 'success');
    taskSelectorClient.finishedTilling(target);
}

/** Calculate the number of weaken threads required to bring
 *  `target` back to its minimum security level.
 */
export function calculateWeakenThreads(ns: NS, target: string): number {
    const minSec = ns.getServerMinSecurityLevel(target);
    const curSec = ns.getServerSecurityLevel(target);
    const deltaSec = curSec - minSec;

    if (deltaSec <= 0 || isNaN(deltaSec)) return 0;

    return Math.ceil(deltaSec * 20);
}
