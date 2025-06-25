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

    let target = rest[0];
    if (typeof target !== 'string' || !ns.serverExists(target)) {
        ns.tprintf("target %s does not exist", target);
        return;
    }

    let managerClient = new ManagerClient(ns);

    let growThreads = neededGrowThreads(ns, target);
    let growSecDelta = ns.growthAnalyzeSecurity(growThreads, target);
    let weakenThreads = weakenAnalyze(growSecDelta);

    if (growThreads < 1 || weakenThreads < 1) {
        ns.printf(`no need to sow ${target}`);
        ns.toast(`finished sowing ${target}!`, "success");
        managerClient.finishedSowing(target);
        return;
    }

    // ns.ui.setTailTitle(`sow ${target}`);
    // ns.ui.openTail();
    // ns.ui.resizeTail(400, 80);

    let expectedTime = ns.tFormat(ns.getWeakenTime(target));

    let weakenResult = await launch(ns, WEAKEN_SCRIPT, weakenThreads, target, 0);
    weakenResult.allocation.releaseAtExit(ns, "weaken");

    let growResult = await launch(ns, GROW_SCRIPT, growThreads, target, 0);
    growResult.allocation.releaseAtExit(ns, "grow");

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

    // ns.ui.closeTail();
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
