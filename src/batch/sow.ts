import type { AutocompleteData, NS } from "netscript";
import { launch } from "batch/launch";
import { registerAllocationOwnership } from "/batch/client/memory";
import { ManagerClient } from "./client/manage";

const GROW_SCRIPT = "/batch/g.js";
const WEAKEN_SCRIPT = "/batch/w.js";

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

Launch as many grow and weaken threads as needed to maximize money
of SERVER_NAME while keeping security at a minimum.

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
            return;
        }
    }

    let target = rest[0];
    if (typeof target !== 'string' || !ns.serverExists(target)) {
        ns.tprintf("target %s does not exist", target);
        return;
    }

    let managerClient = new ManagerClient(ns);

    let growThreads = neededGrowThreads(ns, target);
    let weakenThreads: number;
    if (maxThreads !== -1) {
        growThreads = Math.min(growThreads, maxThreads);
        let growSecDelta = ns.growthAnalyzeSecurity(growThreads, target);
        weakenThreads = weakenAnalyze(growSecDelta);
        while (growThreads + weakenThreads > maxThreads && growThreads > 0) {
            growThreads--;
            growSecDelta = ns.growthAnalyzeSecurity(growThreads, target);
            weakenThreads = weakenAnalyze(growSecDelta);
        }
    } else {
        let growSecDelta = ns.growthAnalyzeSecurity(growThreads, target);
        weakenThreads = weakenAnalyze(growSecDelta);
    }

    if (growThreads < 1 || weakenThreads < 1) {
        ns.printf(`no need to sow ${target}`);
        ns.toast(`finished sowing ${target}!`, "success");
        managerClient.finishedSowing(target);
        return;
    }

    let expectedTime = ns.tFormat(ns.getWeakenTime(target));

    let weakenResult = await launch(
        ns,
        WEAKEN_SCRIPT,
        { threads: weakenThreads, coreDependent: true },
        target,
        0,
    );
    if (!weakenResult) {
        ns.print(`sow failed to allocate for weaken threads`);
        return;
    }

    let growResult = await launch(
        ns,
        GROW_SCRIPT,
        { threads: growThreads, coreDependent: true },
        target,
        0,
    );
    if (!growResult) {
        ns.print(`sow failed to allocate for grow threads`);
        await weakenResult.allocation.release(ns);
        return;
    }

    let pids = [...weakenResult.pids, ...growResult.pids];

    for (const pid of pids) {
        while (ns.isRunning(pid)) {
            ns.clearLog();
            let selfScript = ns.self();
            ns.print(`
Expected time: ${expectedTime}
Elapsed time:  ${ns.tFormat(selfScript.onlineRunningTime * 1000)}
`);
            await ns.sleep(1000);
        }
    }

    await weakenResult.allocation.release(ns);
    await growResult.allocation.release(ns);
    ns.toast(`finished sowing ${target}!`, "success");
    managerClient.finishedSowing(target);
}

function neededGrowThreads(ns: NS, target: string) {
    const maxMoney = ns.getServerMaxMoney(target);
    const currentMoney = ns.getServerMoneyAvailable(target);

    const neededGrowRatio = currentMoney > 0 ? maxMoney / currentMoney : maxMoney;
    const totalGrowThreads = growthAnalyze(ns, target, neededGrowRatio);
    return totalGrowThreads;
}

/** Calculate the number of threads needed to build the server by a
 * certain multiplier.
 */
function growthAnalyze(ns: NS, target: string, growAmount: number): number {
    if (growAmount <= 1) return 0;

    return Math.ceil(ns.growthAnalyze(target, growAmount, 1));
}

function weakenAnalyze(weakenAmount: number): number {
    if (weakenAmount <= 0) return 0;

    return Math.ceil(weakenAmount * 20) + 1;
}

/** Calculate the grow and weaken thread counts required to fully
 *  "sow" the given target server.
 */
export function calculateSowThreads(ns: NS, target: string): { growThreads: number; weakenThreads: number } {
    const growThreads = neededGrowThreads(ns, target);
    const growSecDelta = ns.growthAnalyzeSecurity(growThreads, target);
    const weakenThreads = weakenAnalyze(growSecDelta);
    return { growThreads, weakenThreads };
}
