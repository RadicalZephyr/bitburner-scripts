import type { AutocompleteData, NS } from "netscript";

import { ManagerClient, Lifecycle } from "batch/client/manage";

import { launch } from "batch/launch";

import { registerAllocationOwnership } from "services/client/memory";


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
        registerAllocationOwnership(ns, allocationId, "self");
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

    let managerClient = new ManagerClient(ns);

    let threads = calculateWeakenThreads(ns, target);
    if (maxThreads !== -1) {
        threads = Math.min(threads, maxThreads);
    }

    if (threads == 0 || isNaN(threads)) {
        ns.printf("%s security is already at minimum level", target);
        ns.toast(`finished tilling ${target}!`, "success");
        managerClient.finishedTilling(target);
        return;
    }

    let expectedTime = ns.tFormat(ns.getWeakenTime(target));

    let result = await launch(
        ns,
        "/batch/w.js",
        { threads: threads, coreDependent: true },
        target,
        0,
    );

    for (const pid of result.pids) {
        while (ns.isRunning(pid)) {
            ns.clearLog();
            let selfScript = ns.self();
            ns.print(`
Expected time: ${expectedTime}
Elapsed time:  ${ns.tFormat(selfScript.onlineRunningTime * 1000)}
`);
            await managerClient.heartbeat(ns.pid, ns.getScriptName(), target, Lifecycle.Till);
            await ns.sleep(1000);
        }
    }

    await result.allocation.release(ns);
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
